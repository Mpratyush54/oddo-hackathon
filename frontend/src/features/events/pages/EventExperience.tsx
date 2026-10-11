import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../../../shared/ui/Avatar';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Empty } from '../../../shared/ui/Empty';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { Logo } from '../../../shared/ui/Logo';
import { Modal } from '../../../shared/ui/Modal';
import { date, money, uid } from '../../../shared/utils/format';
import { resolveEventImage } from '../../../../../shared/event-images.js';
import { useStore } from '../../../app/state/StoreProvider';
import type { EventReview } from '../../../shared/types/domain';
import { useSession } from '../../auth/session';
import { eventEnd, eventPhase, eventStart } from '../utils/event-time';
import { EventDetail } from './EventDetail';
import { PublicNav } from '../../../shared/layout/PublicLayout';
import '../styles/experience.css';

const phaseLabels = { upcoming: 'Upcoming', ongoing: 'Happening now', past: 'Past event' };

export default function EventExperience({ publicView = false }: { publicView?: boolean }) {
  const params = useParams();
  const { data, allClubs, organizations, update, toast } = useStore();
  const session = useSession();
  const navigate = useNavigate();
  const clubId = publicView ? params.clubId || session.clubId : session.clubId;
  const source = publicView ? allClubs[clubId] : data;
  const event = source?.events.find((e) => e.id === params.id);
  const club = organizations.find((c) => c.id === clubId);
  const [tab, setTab] = useState<'Overview' | 'Gallery' | 'Reviews'>('Overview');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [tools, setTools] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareFallback, setShareFallback] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [editing, setEditing] = useState(false);
  const [recapDraft, setRecapDraft] = useState('');
  const [photosDraft, setPhotosDraft] = useState<string[]>([]);
  const [coverDraft, setCoverDraft] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [readingPhotos, setReadingPhotos] = useState(false);
  const closeEditor = useCallback(() => setEditing(false), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const images = event
    ? [
        ...new Set(
          [resolveEventImage(event.image, event.id), ...(event.gallery || []).filter(Boolean)].filter(
            Boolean,
          ),
        ),
      ]
    : [];

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setTab('Overview');
    setLightbox(null);
    setTools(false);
    setComment('');
    setError('');
    setEditing(false);
  }, [params.id, clubId]);
  useEffect(() => {
    if (lightbox === null || images.length < 2) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft')
        setLightbox((i) => ((i || 0) - 1 + images.length) % images.length);
      if (event.key === 'ArrowRight') setLightbox((i) => ((i || 0) + 1) % images.length);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [lightbox, images.length]);

  if (!event || !source)
    return (
      <Empty
        title="That event is not on the calendar"
        description="Find another plan in the club directory."
        action={<LinkButton to={publicView ? '/clubs' : '/app/events'}>Explore events</LinkButton>}
      />
    );
  const phase = eventPhase(event, now);
  const past = phase === 'past';
  const staff =
    !publicView &&
    (session.can('manage_events') || session.can('check_in') || session.can('view_finance'));
  const activeTickets = source.tickets.filter(
    (t) => t.eventId === event.id && t.status !== 'Cancelled',
  );
  const myTicket = activeTickets.find(
    (t) => t.email.toLowerCase() === session.user.email.toLowerCase(),
  );
  const waitlist = source.waitlist.find(
    (w) =>
      w.eventId === event.id &&
      w.email.toLowerCase() === session.user.email.toLowerCase() &&
      w.status !== 'Booked',
  );
  const full = event.sold >= event.capacity;
  const offered = waitlist?.status === 'Promoted';
  const reviews = (source.eventReviews || [])
    .filter((r) => r.eventId === event.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const myReview = reviews.find((r) => r.authorId === session.user.id);
  const reviewEligible = session.signedIn && past && !!myTicket?.checkedIn && !myReview;
  const average = reviews.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : 0;
  const sampleGallery = images.some((url) => url.includes('images.unsplash.com'));
  const schedule = (value: Date) =>
    value.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
    });
  const returnTo = `/app/events/${event.id}`;

  function enterWorkspace() {
    session.selectClub(clubId);
    navigate(
      session.signedIn && session.can('book_ticket')
        ? returnTo
        : `/login?returnTo=${encodeURIComponent(returnTo)}`,
    );
  }

  function joinWaitlist() {
    if (!session.signedIn || session.clubId !== clubId) {
      enterWorkspace();
      return;
    }
    if (
      !event ||
      eventPhase(event) === 'past' ||
      myTicket ||
      waitlist ||
      !session.can('book_ticket')
    )
      return;
    update((d) =>
      d.waitlist.some(
        (w) =>
          w.eventId === event.id &&
          w.email.toLowerCase() === session.user.email.toLowerCase() &&
          w.status !== 'Booked',
      )
        ? d
        : {
            ...d,
            waitlist: [
              ...d.waitlist,
              {
                id: uid('WAIT'),
                eventId: event.id,
                name: session.user.name,
                email: session.user.email,
                joined: new Date().toISOString(),
                status: 'Waiting',
              },
            ],
          },
    );
    toast('You are on the waitlist. A seat offer will appear in your in-app inbox.');
  }

  function book() {
    if (!event || eventPhase(event) === 'past') return;
    if (!session.signedIn || session.clubId !== clubId || !session.can('book_ticket')) {
      enterWorkspace();
      return;
    }
    if (myTicket) {
      navigate('/app/my-tickets');
      return;
    }
    if (full && !offered) {
      joinWaitlist();
      return;
    }
    navigate(`/app/checkout?event=${event.id}`);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/e/${clubId}/${event!.id}`);
      setShareFallback('');
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setShareFallback(`${location.origin}/e/${clubId}/${event!.id}`);
    }
  }

  const openEditor = () => {
    setRecapDraft(event.recap || '');
    setPhotosDraft(event.gallery || []);
    setCoverDraft(event.image);
    setPhotoError('');
    setEditing(true);
  };
  const readPhotos = async (files: FileList | null, cover = false) => {
    if (!files?.length) return;
    const chosen = Array.from(files);
    if ((!cover && chosen.length + photosDraft.length > 3) || (cover && chosen.length !== 1)) {
      setPhotoError(
        cover
          ? 'Choose one cover image.'
          : 'Keep up to three gallery images. Remove a sample photo before adding another.',
      );
      return;
    }
    if (
      chosen.some(
        (file) =>
          !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024,
      )
    ) {
      setPhotoError('Use PNG, JPEG, or WebP images, each smaller than 1 MB.');
      return;
    }
    setReadingPhotos(true);
    setPhotoError('');
    try {
      const urls = await Promise.all(
        chosen.map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = reject;
              reader.readAsDataURL(file);
            }),
        ),
      );
      if (cover) setCoverDraft(urls[0]);
      else setPhotosDraft((current) => [...current, ...urls].slice(0, 3));
    } catch {
      setPhotoError('Could not read this image. Try another file.');
    } finally {
      setReadingPhotos(false);
    }
  };

  const actionLabel = past
    ? 'Event ended · bookings closed'
    : myTicket && session.signedIn
      ? 'View my ticket'
      : offered
        ? 'Claim your seat offer'
        : waitlist
          ? 'On the waitlist'
          : full
            ? 'Join the waitlist'
            : event.price
              ? 'Get your ticket'
              : 'Reserve a free spot';

  return (
    <div className={`event-experience ${publicView ? 'event-experience-public' : ''}`}>
      {publicView && <PublicNav />}
      <div className="experience-content">
        <div className="experience-breadcrumb">
          <Link to={publicView ? `/clubs/${clubId}` : '/app/events'}>
            <Icon name="ArrowLeft" size={16} />
            {publicView ? club?.name || 'Club events' : 'All events'}
          </Link>
          <span>{past ? 'The event archive' : 'Make room for something good'}</span>
        </div>
        <section className="experience-heading">
          <div>
            <div className="experience-badges">
              <Badge tone={phase === 'ongoing' ? 'green' : past ? 'neutral' : 'teal'}>
                {phaseLabels[phase]}
              </Badge>
              <span>
                {event.category} · {club?.name}
              </span>
            </div>
            <h1>{event.title}</h1>
            <p>
              {past
                ? 'The moments stay with us. The story lives here.'
                : phase === 'ongoing'
                  ? 'Your people are here. Come be part of it.'
                  : 'A plan worth making. A community worth showing up for.'}
            </p>
          </div>
          <button className="experience-share" onClick={copyLink}>
            <Icon name={copied ? 'Check' : 'Globe'} size={18} />
            {copied ? 'Link copied' : 'Share this event'}
          </button>
        </section>

        {shareFallback && (
          <div className="experience-share-fallback" role="status">
            <span>Copy this public event link:</span>
            <input
              aria-label="Public event link"
              readOnly
              value={shareFallback}
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        )}
        <section
          className={`experience-gallery-hero ${images.length > 1 ? 'has-gallery' : ''}`}
          aria-label="Event images"
        >
          <button
            className="experience-cover"
            onClick={() => setLightbox(0)}
            aria-label="Open event cover image"
          >
            <img src={images[0]} alt={`Event cover for ${event.title}`} />
            <span className="experience-image-shade" />
            <span className="experience-cover-caption">
              <span>{past ? 'THE MOMENTS, REMEMBERED' : 'YOUR NEXT CAMPUS MEMORY'}</span>
              <strong>{event.title}</strong>
            </span>
            <span className="experience-photo-count">
              <Icon name="LayoutGrid" size={15} />
              {images.length === 1 ? 'View cover' : `${images.length} images`}
            </span>
          </button>
          {images.length > 1 && (
            <div className="experience-side-images">
              {images.slice(1, 3).map((image, i) => (
                <button
                  key={image}
                  onClick={() => setLightbox(i + 1)}
                  aria-label={`Open gallery image ${i + 2}`}
                >
                  <img src={image} alt={`Gallery image ${i + 2} for ${event.title}`} />
                  {i === 1 && images.length > 3 && <span>+{images.length - 3} more</span>}
                </button>
              ))}
            </div>
          )}
        </section>
        <p className="experience-image-note">
          {sampleGallery
            ? 'Includes illustrative sample imagery. Sample images are not evidence of event attendance.'
            : images.length > 1
              ? 'Images added to the event gallery.'
              : 'Event cover image. The club has not added a photo gallery yet.'}
        </p>

        <div className="experience-layout">
          <div className="experience-main">
            <div className="experience-tabs" role="tablist" aria-label="Event details">
              {(['Overview', 'Gallery', 'Reviews'] as const).map((t) => (
                <button
                  role="tab"
                  aria-selected={tab === t}
                  aria-controls={`experience-${t.toLowerCase()}`}
                  id={`experience-tab-${t.toLowerCase()}`}
                  key={t}
                  onClick={() => setTab(t)}
                >
                  {t}
                  {t === 'Gallery' && <span>{images.length}</span>}
                  {t === 'Reviews' && <span>{reviews.length}</span>}
                </button>
              ))}
            </div>

            {tab === 'Overview' && (
              <section
                className="experience-panel"
                role="tabpanel"
                id="experience-overview"
                aria-labelledby="experience-tab-overview"
              >
                <span className="experience-kicker">
                  {past ? 'AFTER THE APPLAUSE' : 'GOOD TO KNOW'}
                </span>
                <h2>{past ? 'A look back.' : 'Here is the plan.'}</h2>
                <p className="experience-description">{event.description}</p>
                {past && (
                  <div className="experience-recap">
                    <Icon name="HeartHandshake" size={25} />
                    <div>
                      <h3>Event recap</h3>
                      <p>
                        {event.recap ||
                          'This event has finished. The organizers have not posted a recap yet. Check the gallery and verified attendee reviews for updates.'}
                      </p>
                    </div>
                  </div>
                )}
                {past && staff && (
                  <div className="experience-attendance">
                    <div>
                      <strong>{activeTickets.filter((t) => t.checkedIn).length}</strong>
                      <span>recorded check-ins</span>
                    </div>
                    <div>
                      <strong>{activeTickets.length}</strong>
                      <span>stored active tickets</span>
                    </div>
                    <p>Actual ticket records only. A booking is not counted as attendance.</p>
                  </div>
                )}
                {!past && (
                  <div className="experience-good-to-know">
                    <div>
                      <Icon name="QrCode" size={22} />
                      <span>
                        <strong>Your phone is your ticket.</strong>
                        <small>Show the unique QR code at the door. No printed list needed.</small>
                      </span>
                    </div>
                    <div>
                      <Icon name="BadgeCheck" size={22} />
                      <span>
                        <strong>A little perk for belonging.</strong>
                        <small>Active club memberships qualify for the member ticket price.</small>
                      </span>
                    </div>
                    <div>
                      <Icon name="Heart" size={22} />
                      <span>
                        <strong>Bring your curiosity.</strong>
                        <small>
                          Everyone is welcome, including students who have not joined the club.
                        </small>
                      </span>
                    </div>
                  </div>
                )}
              </section>
            )}

            {tab === 'Gallery' && (
              <section
                className="experience-panel"
                role="tabpanel"
                id="experience-gallery"
                aria-labelledby="experience-tab-gallery"
              >
                <span className="experience-kicker">THE VISUAL STORY</span>
                <h2>{images.length > 1 ? 'A few moments to explore.' : 'The event cover.'}</h2>
                <p>
                  {sampleGallery
                    ? 'Sample images are illustrative. Organizers can replace them with photographs from their own event.'
                    : images.length > 1
                      ? 'Open any image for a closer look.'
                      : 'Only the cover has been added. More photos will appear when the organizing team adds them.'}
                </p>
                <div className="experience-gallery-grid">
                  {images.map((image, i) => (
                    <button
                      key={image}
                      onClick={() => setLightbox(i)}
                      aria-label={`Open image ${i + 1}`}
                    >
                      <img src={image} alt={`${event.title} image ${i + 1}`} loading="lazy" />
                      <span>{i === 0 ? 'Event cover' : `Gallery image ${i + 1}`}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {tab === 'Reviews' && (
              <section
                className="experience-panel"
                role="tabpanel"
                id="experience-reviews"
                aria-labelledby="experience-tab-reviews"
              >
                <div className="experience-review-heading">
                  <div>
                    <span className="experience-kicker">FROM PEOPLE WHO WERE THERE</span>
                    <h2>Attendee experiences.</h2>
                  </div>
                  {reviews.length > 0 && (
                    <div className="experience-rating-summary">
                      <strong>{average.toFixed(1)}</strong>
                      <span>
                        ★ / 5 · {reviews.length} review{reviews.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  )}
                </div>
                <p className="experience-local-note">
                  <Icon name="CircleHelp" size={16} />
                  Reviews are written in this browser demo. We do not add fictional testimonials.
                </p>
                {reviews.length ? (
                  <div className="experience-review-list">
                    {reviews.map((review) => (
                      <article key={review.id}>
                        <div>
                          <Avatar name={review.authorName} />
                          <span>
                            <strong>{review.authorName}</strong>
                            <small>{date(review.date)}</small>
                          </span>
                          <span
                            className="experience-review-stars"
                            aria-label={`${review.rating} out of 5 stars`}
                          >
                            {'★'.repeat(review.rating)}
                            {'☆'.repeat(5 - review.rating)}
                          </span>
                        </div>
                        <p>{review.comment}</p>
                        <span className="experience-review-verified">
                          <Icon name="UserCheck" size={14} />
                          Checked-in attendee · local demo review
                        </span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="experience-review-empty">
                    <Icon name="HeartHandshake" size={30} />
                    <h3>No reviews yet.</h3>
                    <p>
                      {past
                        ? 'A checked-in attendee can share the first experience.'
                        : 'Reviews open after the event finishes, for attendees checked in at the door.'}
                    </p>
                  </div>
                )}
                {reviewEligible && session.clubId === clubId ? (
                  <form
                    className="experience-review-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!past || !myTicket?.checkedIn || myReview || session.clubId !== clubId)
                        return;
                      if (comment.trim().length < 10) {
                        setError('Tell us a little more. Write at least 10 characters.');
                        return;
                      }
                      const review: EventReview = {
                        id: uid('REVIEW'),
                        eventId: event.id,
                        authorId: session.user.id,
                        authorName: session.user.name,
                        rating,
                        comment: comment.trim(),
                        date: new Date().toISOString(),
                      };
                      update((d) =>
                        (d.eventReviews || []).some(
                          (r) => r.eventId === event.id && r.authorId === session.user.id,
                        )
                          ? d
                          : { ...d, eventReviews: [review, ...(d.eventReviews || [])] },
                      );
                      setComment('');
                      setError('');
                      toast('Your attendee review has been saved in this demo.');
                    }}
                  >
                    <h3>What was your experience?</h3>
                    <fieldset className="experience-rating-input">
                      <legend>Your rating</legend>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <label key={n}>
                          <input
                            type="radio"
                            name="rating"
                            value={n}
                            checked={rating === n}
                            onChange={() => setRating(n)}
                          />
                          <span className={n <= rating ? 'lit' : ''} aria-hidden="true">
                            ★
                          </span>
                          <span className="experience-sr-only">
                            {n} star{n === 1 ? '' : 's'}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <label className="experience-comment-label">
                      Your review
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        required
                        minLength={10}
                        maxLength={1200}
                        rows={4}
                        placeholder="What worked well? What could the team improve?"
                      />
                    </label>
                    {error && (
                      <p className="inline-error" role="alert">
                        {error}
                      </p>
                    )}
                    <Button type="submit" icon="Check">
                      Post my review
                    </Button>
                    <small>
                      Your name appears with the review. One review per checked-in attendee.
                    </small>
                  </form>
                ) : myReview ? (
                  <div className="experience-review-status">
                    <Icon name="CircleCheck" size={19} />
                    Thank you. Your review is part of this event's story.
                  </div>
                ) : reviewEligible ? (
                  <Button variant="secondary" onClick={enterWorkspace}>
                    Open this club to write a review
                  </Button>
                ) : past && !session.signedIn ? (
                  <Button variant="secondary" onClick={enterWorkspace}>
                    Sign in to share your experience
                  </Button>
                ) : null}
              </section>
            )}
          </div>

          <aside className="experience-booking">
            <div className="experience-booking-top">
              <Badge tone={past ? 'neutral' : phase === 'ongoing' ? 'green' : 'teal'}>
                {phaseLabels[phase]}
              </Badge>
              <span className="experience-kicker">
                {past ? 'THE EVENT HAS FINISHED' : 'MAKE IT PART OF YOUR SEMESTER'}
              </span>
              <h2>
                {past ? 'A good memory.' : full ? 'Good things fill up.' : 'Your place is waiting.'}
              </h2>
            </div>
            <dl className="experience-event-facts">
              <div>
                <Icon name="CalendarDays" size={21} />
                <span>
                  <dt>{past ? 'Took place' : 'Save the date'}</dt>
                  <dd>
                    {date(event.date, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </dd>
                </span>
              </div>
              <div>
                <Icon name="Clock3" size={21} />
                <span>
                  <dt>Campus time · IST</dt>
                  <dd>
                    {schedule(eventStart(event))} – {schedule(eventEnd(event))}
                  </dd>
                  {!event.endTime && <small>Estimated two-hour event window</small>}
                </span>
              </div>
              <div>
                <Icon name="MapPin" size={21} />
                <span>
                  <dt>Meet us here</dt>
                  <dd>{event.venue}</dd>
                </span>
              </div>
            </dl>
            {!past && (
              <>
                <div className="experience-ticket-prices">
                  <div>
                    <span>Member ticket</span>
                    <strong>{event.memberPrice ? money(event.memberPrice) : 'Free'}</strong>
                  </div>
                  <div>
                    <span>Standard ticket</span>
                    <strong>{event.price ? money(event.price) : 'Free'}</strong>
                  </div>
                </div>
                <div className="experience-capacity">
                  <span>
                    {full
                      ? 'All places reserved'
                      : `${Math.max(0, event.capacity - event.sold)} places available`}
                  </span>
                  <span>{event.capacity} capacity</span>
                </div>
              </>
            )}
            <Button
              disabled={past || (!!waitlist && !offered && !myTicket)}
              icon={past ? 'CalendarClock' : full && !offered ? 'ListPlus' : 'Ticket'}
              className="full-width"
              onClick={book}
            >
              {actionLabel}
            </Button>
            <p className="experience-booking-note">
              {past
                ? 'Booking and waitlist are closed. Explore the recap, gallery, and attendee reviews.'
                : offered
                  ? 'Your seat offer is reserved. Confirm it at demo checkout.'
                  : waitlist
                    ? 'Look for a seat offer in your in-app inbox.'
                    : 'Interactive demo checkout. No real money is charged.'}
            </p>
            {past && (
              <Link
                to={publicView ? `/clubs/${clubId}` : '/app/events'}
                className="experience-next-plan"
              >
                Find your next plan <Icon name="ArrowRight" size={16} />
              </Link>
            )}
          </aside>
        </div>

        {staff && (
          <section className="experience-tools">
            <button
              onClick={() => setTools(!tools)}
              aria-expanded={tools}
              aria-controls="experience-organizer-tools"
            >
              <span>
                <Icon name="Settings2" size={20} />
                <span>
                  <strong>Organizer workspace</strong>
                  <small>Guest list, check-in, ticket reports, and event finances</small>
                </span>
              </span>
              <Icon name={tools ? 'ChevronDown' : 'ChevronRight'} size={18} />
            </button>
            {tools && (
              <div id="experience-organizer-tools" className="experience-organizer-content">
                {session.can('manage_events') && (
                  <div className="experience-edit-bar">
                    <div>
                      <strong>Tell the event's story.</strong>
                      <p>Add your recap and replace sample images with event photos.</p>
                    </div>
                    <Button variant="secondary" icon="PenLine" onClick={openEditor}>
                      Edit recap & photos
                    </Button>
                  </div>
                )}
                <EventDetail />
              </div>
            )}
          </section>
        )}
        {publicView && (
          <footer className="experience-public-footer">
            <Logo />
            <span>More campus life. Less chasing.</span>
            <Link to="/clubs">Find your people →</Link>
          </footer>
        )}
      </div>
      {editing && session.can('manage_events') && (
        <Modal
          title="Edit recap & photos"
          description="Use your own event story and images. The cover changes only when you replace it explicitly."
          onClose={closeEditor}
          wide
        >
          <form
            className="experience-edit-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (readingPhotos || !session.can('manage_events')) return;
              update((d) => ({
                ...d,
                events: d.events.map((item) =>
                  item.id === event.id
                    ? { ...item, recap: recapDraft.trim(), gallery: photosDraft, image: coverDraft }
                    : item,
                ),
              }));
              setEditing(false);
              toast('Event recap and images updated in your local demo.');
            }}
          >
            <label className="experience-comment-label">
              Event recap
              <textarea
                value={recapDraft}
                onChange={(e) => setRecapDraft(e.target.value)}
                maxLength={2500}
                rows={5}
                placeholder="What happened? What did your team accomplish? Add the real highlights."
              />
            </label>
            <div className="experience-edit-section">
              <div>
                <h3>Gallery photos</h3>
                <small>{photosDraft.length} / 3 images · PNG, JPEG, WebP · up to 1 MB each</small>
              </div>
              {photosDraft.length > 0 && (
                <Button variant="secondary" onClick={() => setPhotosDraft([])}>
                  Clear gallery
                </Button>
              )}
            </div>
            {photosDraft.length > 0 && (
              <div className="experience-edit-photos">
                {photosDraft.map((photo, i) => (
                  <div key={`${i}-${photo.slice(-20)}`}>
                    <img src={photo} alt={`Gallery preview ${i + 1}`} />
                    <button
                      type="button"
                      aria-label={`Remove gallery photo ${i + 1}`}
                      onClick={() =>
                        setPhotosDraft((photos) => photos.filter((_, index) => index !== i))
                      }
                    >
                      <Icon name="X" size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="experience-image-upload">
              <Icon name="CloudUpload" size={23} />
              <span>
                Add gallery images
                <small>Remove sample images first if all three slots are filled.</small>
              </span>
              <input
                aria-label="Upload gallery images"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                disabled={readingPhotos || photosDraft.length >= 3}
                onChange={(e) => {
                  void readPhotos(e.target.files);
                  e.currentTarget.value = '';
                }}
              />
            </label>
            <div className="experience-edit-cover">
              <img src={coverDraft} alt="Current event cover preview" />
              <label>
                Replace cover image (optional)
                <small>Your cover remains unchanged if you skip this field.</small>
                <input
                  aria-label="Replace event cover image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={readingPhotos}
                  onChange={(e) => {
                    void readPhotos(e.target.files, true);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
            {photoError && (
              <p className="inline-error" role="alert">
                {photoError}
              </p>
            )}
            <p className="experience-editor-note">
              Images and recap are saved in this browser demo. Use smaller photos to leave room for
              receipts and other local records.
            </p>
            <div className="form-footer">
              <Button variant="secondary" onClick={closeEditor}>
                Cancel
              </Button>
              <Button type="submit" icon="Check" disabled={readingPhotos}>
                {readingPhotos ? 'Reading photos…' : 'Save recap & photos'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {lightbox !== null && (
        <Modal
          title={event.title}
          description={`${images[lightbox]?.includes('images.unsplash.com') ? 'Illustrative sample image' : 'Event image'} · ${lightbox + 1} of ${images.length}`}
          onClose={closeLightbox}
          wide
        >
          <div className="experience-lightbox">
            <img src={images[lightbox]} alt={`${event.title} image ${lightbox + 1}`} />
            {images.length > 1 && (
              <div>
                <Button
                  variant="secondary"
                  icon="ChevronLeft"
                  onClick={() => setLightbox((lightbox - 1 + images.length) % images.length)}
                >
                  Previous
                </Button>
                <span>
                  {lightbox + 1} / {images.length}
                </span>
                <Button
                  variant="secondary"
                  icon="ChevronRight"
                  onClick={() => setLightbox((lightbox + 1) % images.length)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export { EventExperience };
