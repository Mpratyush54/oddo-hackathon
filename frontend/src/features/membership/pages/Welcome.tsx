import { useState } from 'react';
import { CommunityArt } from '../../../shared/ui/CommunityArt';
import { Icon } from '../../../shared/ui/Icon';
import { LinkButton } from '../../../shared/ui/LinkButton';
import { Logo } from '../../../shared/ui/Logo';

export function WelcomePage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav>
          <a href="#features">Your workspace</a>
          <a href="#how">How it works</a>
          <a href="#faq">Questions?</a>
        </nav>
        <LinkButton to="/" variant="gold-button" icon="ArrowUpRight">
          Open your workspace
        </LinkButton>
      </header>
      <main>
        <section className="landing-hero">
          <div>
            <div className="eyebrow">FOR THE PEOPLE WHO BRING PEOPLE TOGETHER</div>
            <h1>
              A little less admin.
              <br />A lot more <em>community.</em>
            </h1>
            <p>
              Members, events, projects, and every rupee.
              <br />
              One thoughtful home for your student organization.
            </p>
            <LinkButton to="/" variant="gold-button" icon="ArrowRight">
              Meet your new workspace
            </LinkButton>
            <span className="landing-small">
              <Icon name="Sparkles" size={16} />
              Big ideas. Better together.
            </span>
          </div>
          <div className="landing-illustration">
            <CommunityArt />
            <div className="floating-note">
              <Icon name="BadgeCheck" />
              Everything, a little more connected.
            </div>
          </div>
        </section>
        <section id="features" className="landing-features">
          {[
            [
              'UsersRound',
              'People, first.',
              'Know your members, keep track of dues, and make everyone feel at home.',
            ],
            [
              'CalendarDays',
              'Make a little magic.',
              'Plan events, sell tickets, and welcome everyone at the door.',
            ],
            [
              'Wallet',
              'Clarity in every rupee.',
              'Income, expenses, and reimbursements. All in the same place.',
            ],
          ].map(([icon, title, body]) => (
            <article key={title}>
              <Icon name={icon} size={28} />
              <h2>{title}</h2>
              <p>{body}</p>
            </article>
          ))}
        </section>
        <section id="how" className="landing-how">
          <div className="eyebrow">SIMPLE ENOUGH FOR A BUSY SEMESTER</div>
          <h2>More doing. Less chasing.</h2>
          <div>
            {[
              ['01', 'Bring your people in', 'Add members and let your community grow.'],
              ['02', 'Give your plans a home', 'Create events, share news, and split the work.'],
              [
                '03',
                'Keep the bigger picture clear',
                'See your progress and finances at a glance.',
              ],
            ].map(([n, title, body]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="faq" className="landing-faq">
          <h2>A few things you might wonder.</h2>
          {[
            [
              'Can I try the workspace?',
              'Absolutely. Open the workspace to explore the demo, add records, and try the flows. Your changes are saved in your browser.',
            ],
            [
              'Does this take real payments?',
              'The current workspace demonstrates checkout and bookkeeping. No real payment is charged. A payment provider and backend can be connected for launch.',
            ],
            [
              'Who is Skyline for?',
              'Student clubs, campus communities, and the people who help them thrive. This workspace is tailored to the Skyline Student Association.',
            ],
          ].map(([q, a], i) => (
            <article key={q}>
              <button
                aria-expanded={openFAQ === i}
                onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
              >
                {q}
                <Icon name={openFAQ === i ? 'Minus' : 'Plus'} />
              </button>
              {openFAQ === i && <p>{a}</p>}
            </article>
          ))}
        </section>
        <section className="landing-cta">
          <Icon name="Sprout" size={40} />
          <h2>Good things start with your people.</h2>
          <LinkButton to="/" variant="gold-button" icon="ArrowRight">
            Let’s bring it together
          </LinkButton>
        </section>
      </main>
      <footer>
        <Logo />
        <span>© 2026 Skyline Student Association. Better together.</span>
      </footer>
    </div>
  );
}
