import type { Member, Ticket, Organization, Store } from '../../shared/types/domain';
import { today, date } from '../../shared/utils/format';

export const seed: Store = {
  profile: { name: 'Alex Morgan', email: 'alex@skyline.edu', role: 'Club president' },
  preferences: { email: true, renewals: true, weekly: false },
  members: [
    {
      id: 'MEM-001',
      name: 'Alex Morgan',
      email: 'alex@skyline.edu',
      course: 'Computer Science',
      status: 'Active',
      joined: '2026-08-12',
      expires: '2027-07-31',
      role: 'President',
    },
    {
      id: 'MEM-002',
      name: 'Priya Sharma',
      email: 'priya@skyline.edu',
      course: 'Business Administration',
      status: 'Active',
      joined: '2026-08-14',
      expires: '2027-07-31',
      role: 'Treasurer',
    },
    {
      id: 'MEM-003',
      name: 'Jordan Lee',
      email: 'jordan@skyline.edu',
      course: 'Visual Communication',
      status: 'Active',
      joined: '2026-08-18',
      expires: '2027-07-31',
      role: 'Events lead',
    },
    {
      id: 'MEM-004',
      name: 'Sam Wilson',
      email: 'sam@skyline.edu',
      course: 'Mechanical Engineering',
      status: 'Pending',
      joined: '2026-10-08',
      expires: '2027-07-31',
      role: 'Volunteer',
    },
    {
      id: 'MEM-005',
      name: 'Aisha Patel',
      email: 'aisha@skyline.edu',
      course: 'Economics',
      status: 'Active',
      joined: '2026-09-02',
      expires: '2027-07-31',
      role: 'Volunteer',
    },
    {
      id: 'MEM-006',
      name: 'Ryan Chen',
      email: 'ryan@skyline.edu',
      course: 'Computer Science',
      status: 'Expiring',
      joined: '2025-10-20',
      expires: '2026-10-20',
      role: 'Volunteer',
    },
    {
      id: 'MEM-007',
      name: 'Maya Johnson',
      email: 'maya@skyline.edu',
      course: 'Psychology',
      status: 'Pending',
      joined: '2026-10-09',
      expires: '2027-07-31',
      role: 'Volunteer',
    },
    {
      id: 'MEM-008',
      name: 'Noah Williams',
      email: 'noah@skyline.edu',
      course: 'Media Studies',
      status: 'Active',
      joined: '2026-09-12',
      expires: '2027-07-31',
      role: 'Volunteer',
    },
    {
      id: 'MEM-009',
      name: 'Emma Davis',
      email: 'emma@skyline.edu',
      course: 'Architecture',
      status: 'Expiring',
      joined: '2025-10-24',
      expires: '2026-10-24',
      role: 'Volunteer',
    },
    {
      id: 'MEM-010',
      name: 'Arjun Mehta',
      email: 'arjun@skyline.edu',
      course: 'Mathematics',
      status: 'Active',
      joined: '2026-09-15',
      expires: '2027-07-31',
      role: 'Volunteer',
    },
    {
      id: 'MEM-011',
      name: 'Olivia Brown',
      email: 'olivia@skyline.edu',
      course: 'Literature',
      status: 'Active',
      joined: '2026-09-18',
      expires: '2027-07-31',
      role: 'Volunteer',
    },
    {
      id: 'MEM-012',
      name: 'Ethan Taylor',
      email: 'ethan@skyline.edu',
      course: 'Design',
      status: 'Pending',
      joined: '2026-10-10',
      expires: '2027-07-31',
      role: 'Volunteer',
    },
  ],
  events: [
    {
      id: 'EVT-001',
      title: 'The Skyline Gala',
      date: '2026-10-24',
      time: '18:00',
      venue: 'The Grand Hall, Campus East',
      category: 'Social',
      price: 750,
      memberPrice: 500,
      capacity: 180,
      sold: 126,
      description:
        'An evening to remember. Join your Skyline community for live music, a three-course dinner, and a celebration of everything we have built together. Dress up, bring a friend, and make some memories.',
      image:
        'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1000&q=85',
    },
    {
      id: 'EVT-002',
      title: 'Bake a difference',
      date: '2026-10-16',
      time: '10:00',
      venue: 'Student Union Courtyard',
      category: 'Fundraiser',
      price: 0,
      memberPrice: 0,
      capacity: 120,
      sold: 48,
      description:
        'Good bakes for a great cause. Our student-led bake sale supports the campus community fund. Come for the cookies, stay for the conversation.',
      image:
        'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=1000&q=85',
    },
    {
      id: 'EVT-003',
      title: 'Ideas & iced coffee',
      date: '2026-10-14',
      time: '16:30',
      venue: 'Library Café',
      category: 'Meeting',
      price: 0,
      memberPrice: 0,
      capacity: 40,
      sold: 28,
      description:
        'Our monthly community catch-up. Share ideas for the next semester, meet the committee, and enjoy a coffee on us. Everyone is welcome.',
      image:
        'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=85',
    },
    {
      id: 'EVT-004',
      title: 'Build your next big thing',
      date: '2026-11-06',
      time: '14:00',
      venue: 'Innovation Lab, Block B',
      category: 'Workshop',
      price: 250,
      memberPrice: 150,
      capacity: 60,
      sold: 18,
      description:
        'A hands-on design thinking workshop for curious minds. Turn an idea into a prototype with mentors from across campus. No experience needed.',
      image:
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1000&q=85',
    },
  ],
  transactions: [
    {
      id: 'TX-001',
      title: 'Annual membership dues',
      category: 'Membership',
      amount: 42000,
      date: '2026-08-20',
      status: 'Completed',
    },
    {
      id: 'TX-002',
      title: 'Welcome week supplies',
      category: 'Expenses',
      amount: -4800,
      date: '2026-08-22',
      status: 'Completed',
      receipt: 'welcome-week.pdf',
    },
    {
      id: 'TX-003',
      title: 'Club T-shirt orders',
      category: 'Merchandise',
      amount: 8400,
      date: '2026-09-05',
      status: 'Completed',
    },
    {
      id: 'TX-004',
      title: 'Print & production',
      category: 'Expenses',
      amount: -6200,
      date: '2026-09-08',
      status: 'Completed',
      receipt: 'printing.pdf',
    },
    {
      id: 'TX-005',
      title: 'Community fundraiser',
      category: 'Fundraiser',
      amount: 7600,
      date: '2026-09-18',
      status: 'Completed',
    },
    {
      id: 'TX-006',
      title: 'The Skyline Gala · ticket sales',
      category: 'Tickets',
      amount: 18500,
      date: '2026-10-02',
      status: 'Completed',
    },
    {
      id: 'TX-007',
      title: 'Gala venue deposit',
      category: 'Expenses',
      amount: -15000,
      date: '2026-10-03',
      status: 'Completed',
      receipt: 'venue-deposit.pdf',
    },
    {
      id: 'TX-008',
      title: 'Skyline hoodie orders',
      category: 'Merchandise',
      amount: 6600,
      date: '2026-10-08',
      status: 'Completed',
    },
    {
      id: 'TX-009',
      title: 'Bake sale supplies · Aisha',
      category: 'Expenses',
      amount: -1250,
      date: '2026-10-09',
      status: 'Pending',
      receipt: 'supplies.jpg',
    },
    {
      id: 'TX-010',
      title: 'Poster printing · Jordan',
      category: 'Expenses',
      amount: -850,
      date: '2026-10-10',
      status: 'Pending',
      receipt: 'posters.pdf',
    },
  ],
  tasks: [
    {
      id: 'TASK-001',
      title: 'Order ingredients & supplies',
      description: 'Flour, chocolate, butter, and recyclable packaging.',
      assignee: 'Aisha Patel',
      due: '2026-10-13',
      priority: 'High',
      status: 'To do',
    },
    {
      id: 'TASK-002',
      title: 'Confirm volunteer shifts',
      description: 'Organize two-hour shifts for the bake sale table.',
      assignee: 'Alex Morgan',
      due: '2026-10-14',
      priority: 'Medium',
      status: 'To do',
    },
    {
      id: 'TASK-003',
      title: 'Design the fundraiser posters',
      description: 'A4 posters and a square social media post.',
      assignee: 'Jordan Lee',
      due: '2026-10-12',
      priority: 'High',
      status: 'In progress',
    },
    {
      id: 'TASK-004',
      title: 'Bake cookies & brownies',
      description: 'Prepare 60 portions. Include a vegan option.',
      assignee: 'Noah Williams',
      due: '2026-10-15',
      priority: 'Medium',
      status: 'In progress',
    },
    {
      id: 'TASK-005',
      title: 'Book the courtyard table',
      description: 'Confirm with the Student Union office.',
      assignee: 'Priya Sharma',
      due: '2026-10-08',
      priority: 'Low',
      status: 'Done',
    },
    {
      id: 'TASK-006',
      title: 'Set the fundraiser budget',
      description: 'Approved supplies budget: ₹2,000.',
      assignee: 'Priya Sharma',
      due: '2026-10-09',
      priority: 'Medium',
      status: 'Done',
    },
  ],
  products: [
    {
      id: 'PROD-001',
      name: 'The everyday hoodie',
      type: 'Hoodie',
      price: 1200,
      memberPrice: 999,
      color: 'teal',
      stock: { S: 8, M: 12, L: 6, XL: 4 },
      image:
        'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1000&q=85',
    },
    {
      id: 'PROD-002',
      name: 'Wear your community',
      type: 'T-shirt',
      price: 600,
      memberPrice: 499,
      color: 'cream',
      stock: { S: 10, M: 14, L: 9, XL: 0 },
      image:
        'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1000&q=85',
    },
    {
      id: 'PROD-003',
      name: 'A little carry-all',
      type: 'Tote bag',
      price: 450,
      memberPrice: 350,
      color: 'green',
      stock: { 'One size': 18 },
      image:
        'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85',
    },
  ],
  promos: [
    {
      id: 'PROMO-WELCOME',
      code: 'WELCOME10',
      type: 'percent',
      value: 10,
      active: true,
      maxRedemptions: 200,
      redemptions: 0,
      memberOnly: false,
      minSubtotal: 0,
      description: '10% off merchandise for everyone',
    },
    {
      id: 'PROMO-MEMBER',
      code: 'MEMBER50',
      type: 'fixed',
      value: 50,
      active: true,
      maxRedemptions: 100,
      redemptions: 0,
      memberOnly: true,
      minSubtotal: 400,
      description: '₹50 off for active members (min ₹400)',
    },
    {
      id: 'PROMO-CAMPUS',
      code: 'CAMPUS100',
      type: 'fixed',
      value: 100,
      active: true,
      maxRedemptions: 50,
      redemptions: 0,
      memberOnly: false,
      minSubtotal: 900,
      description: '₹100 off orders of ₹900+',
    },
  ],
  pointLedger: [],
  announcements: [
    {
      id: 'ANN-001',
      title: 'Something special is on the calendar ✨',
      body: 'The Skyline Gala is officially happening on October 24! Tickets are now live, and members get an exclusive ₹250 discount. Bring your friends and join us for our biggest night of the semester.',
      audience: 'All members',
      date: '2026-10-09',
      author: 'Jordan Lee',
      read: 9,
      email: true,
    },
    {
      id: 'ANN-002',
      title: 'Calling all bakers (and taste testers)',
      body: 'Our community bake sale is next Friday. We are looking for a few more helping hands! Check the project board to find a task that works for you. Every little contribution makes a difference.',
      audience: 'Volunteers',
      date: '2026-10-07',
      author: 'Aisha Patel',
      read: 5,
      email: true,
    },
    {
      id: 'ANN-003',
      title: 'Your ideas belong here',
      body: 'Come along to our monthly meeting at the Library Café on October 14. Whether you have a big idea or just want to say hi, there is a seat for you. Coffee is on us.',
      audience: 'All members',
      date: '2026-10-05',
      author: 'Alex Morgan',
      read: 10,
      email: false,
    },
  ],
  tickets: [
    {
      id: 'SKY-1001',
      eventId: 'EVT-001',
      name: 'Priya Sharma',
      email: 'priya@skyline.edu',
      member: true,
      checkedIn: false,
      amount: 500,
    },
    {
      id: 'SKY-1002',
      eventId: 'EVT-001',
      name: 'Jordan Lee',
      email: 'jordan@skyline.edu',
      member: true,
      checkedIn: true,
      amount: 500,
    },
    {
      id: 'SKY-1003',
      eventId: 'EVT-001',
      name: 'Sam Wilson',
      email: 'sam@skyline.edu',
      member: false,
      checkedIn: false,
      amount: 750,
    },
  ],
  orders: [],
  waitlist: [],
  audit: [],
  deliveries: [],
  notifications: [],
};

export const organizations: Organization[] = [
  {
    id: 'skyline',
    name: 'Skyline Association',
    slug: 'skyline',
    description:
      'Campus life, a little more connected. Events, friendships, and opportunities for every student.',
    accent: 'teal',
  },
  {
    id: 'codecraft',
    name: 'CodeCraft Society',
    slug: 'codecraft',
    description:
      'Curious minds building useful things. Hack nights, workshops, and a community of makers.',
    accent: 'purple',
  },
  {
    id: 'canvas',
    name: 'Canvas Collective',
    slug: 'canvas',
    description: 'Art, culture, and creative expression. A home for the campus’s next great ideas.',
    accent: 'gold',
  },
];

export function makeClub(id: string): Store {
  const club = structuredClone(seed);
  club.members = club.members.map((m, i) => ({
    ...m,
    phone: i < 6 ? `+9198000010${String(i).padStart(2, '0')}` : undefined,
    whatsappOptIn: i < 5,
  }));
  if (id === 'skyline') {
    const names = [
      'Zara Khan',
      'Liam Cooper',
      'Isha Gupta',
      'Dev Kumar',
      'Sophie Martin',
      'Kabir Singh',
      'Grace Thomas',
      'Rohan Das',
      'Ananya Roy',
      'Lucas Clark',
      'Nisha Rao',
      'Leo Walker',
      'Sara Ali',
      'Vihaan Shah',
      'Chloe Evans',
      'Aditya Jain',
      'Mia Roberts',
      'Aryan Kapoor',
      'Isabel Hall',
      'Neil Bose',
      'Riya Sen',
      'Oscar Green',
      'Tara Nair',
      'Henry Scott',
      'Meera Iyer',
      'Finn Adams',
      'Diya Verma',
      'Ben Harris',
    ];
    club.members.push(
      ...names.map((name, i): Member => ({
        id: `MEM-${String(i + 13).padStart(3, '0')}`,
        name,
        email: `${name.split(' ')[0].toLowerCase()}@skyline.edu`,
        course: ['Computer Science', 'Economics', 'Media Studies', 'Architecture'][i % 4],
        status: i % 8 === 0 ? 'Pending' : 'Active',
        role: 'Volunteer',
        joined: `2026-09-${String(i + 1).padStart(2, '0')}`,
        expires: '2027-07-31',
        whatsappOptIn: false,
      })),
    );
  }
  const counts =
    id === 'skyline' ? [26, 18, 12, 18] : id === 'codecraft' ? [8, 6, 9, 12] : [7, 9, 6, 12];
  club.events = club.events.map((e, i) => ({
    ...e,
    capacity: [60, 80, 40, counts[3]][i],
    sold: counts[i],
    budget: [18000, 2000, 1200, 1500][i],
    title:
      id === 'skyline'
        ? e.title
        : (id === 'codecraft'
            ? ['Builders night', 'Code for good', 'Coffee & code', 'Ship your first app']
            : ['Canvas after hours', 'Art for a cause', 'Sketchbook social', 'Printmaking studio'])[
            i
          ],
  }));
  club.tickets = club.events.flatMap((e) =>
    Array.from({ length: e.sold }, (_, i): Ticket => {
      const m = club.members[i % club.members.length];
      const eligible = m.status === 'Active' || m.status === 'Expiring';
      return {
        id: `${id.toUpperCase()}-${e.id}-${String(i + 1).padStart(3, '0')}`,
        eventId: e.id,
        name: m.name,
        email: m.email,
        member: eligible,
        checkedIn: i < 2 && e.id === 'EVT-001',
        amount: eligible ? e.memberPrice : e.price,
        status: 'Confirmed',
      };
    }),
  );
  club.orders = Array.from({ length: id === 'skyline' ? 12 : 4 }, (_, i) => ({
    id: `ORD-${id}-${i + 1}`,
    productId: i < 6 ? 'PROD-002' : 'PROD-001',
    name: club.members[i % club.members.length].name,
    size: ['S', 'M', 'L'][i % 3],
    amount: i < 6 ? 499 : 999,
    date: i < 6 ? '2026-09-05' : '2026-10-08',
  }));
  club.transactions = club.transactions.map((t) => ({
    ...t,
    amount:
      t.id === 'TX-001'
        ? club.members.filter((m) => m.status !== 'Pending' && m.status !== 'Expired').length * 500
        : t.id === 'TX-003'
          ? club.orders.filter((o) => o.productId === 'PROD-002').reduce((s, o) => s + o.amount, 0)
          : t.id === 'TX-006'
            ? club.tickets.filter((t) => t.eventId === 'EVT-001').reduce((s, t) => s + t.amount, 0)
            : t.id === 'TX-008'
              ? club.orders
                  .filter((o) => o.productId === 'PROD-001')
                  .reduce((s, o) => s + o.amount, 0)
              : t.amount,
    eventId: ['TX-006', 'TX-007'].includes(t.id)
      ? 'EVT-001'
      : ['TX-005', 'TX-009'].includes(t.id)
        ? 'EVT-002'
        : undefined,
    createdBy: t.id === 'TX-009' ? 'MEM-005' : t.id === 'TX-010' ? 'MEM-003' : 'MEM-002',
  }));
  club.events
    .filter((e) => e.id !== 'EVT-001')
    .forEach((e) => {
      const revenue = club.tickets
        .filter((t) => t.eventId === e.id)
        .reduce((s, t) => s + t.amount, 0);
      if (revenue)
        club.transactions.push({
          id: `TX-${e.id}`,
          title: `${e.title} · ticket sales`,
          category: 'Tickets',
          amount: revenue,
          date: today,
          status: 'Completed',
          eventId: e.id,
          createdBy: 'MEM-003',
        });
    });
  club.products[0].stock.XL = 2;
  club.products[1].stock.XL = 0;
  club.products = club.products.map((p) => ({
    ...p,
    image:
      p.image ||
      (p.type === 'T-shirt'
        ? 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1000&q=85'
        : p.type === 'Tote bag'
          ? 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=85'
          : 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1000&q=85'),
  }));
  club.promos = club.promos?.length ? club.promos : structuredClone(seed.promos || []);
  club.pointLedger = club.pointLedger || [];
  club.members = club.members.map((m, i) => ({
    ...m,
    participationPoints: m.participationPoints ?? (i % 3 === 0 ? 20 : 10),
    volunteerPoints:
      m.volunteerPoints ?? (m.role === 'Volunteer' || m.role === 'President' ? 40 : 5),
    contributionPoints: m.contributionPoints ?? (i % 4 === 0 ? 15 : 0),
  }));
  club.notifications = [
    {
      id: 'NOT-WELCOME',
      title: 'Welcome to your connected campus',
      body: 'Your club, your people, and your next big idea. All in one place.',
      date: today,
      read: false,
      to: '/app',
    },
  ];
  return club;
}

export function enrichEventHistory(club: Store, clubId: string): Store {
  // Repair inherited sample descriptions only; preserve organizer-written descriptions.
  const themes: Record<
    string,
    { image: string; description: string; venue: string; category: string }[]
  > = {
    codecraft: [
      {
        image:
          'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=85',
        description:
          'Bring your project to an evening of live demos, debugging help and conversations with student builders. Beginners are welcome.',
        venue: 'Innovation Lab, Block B',
        category: 'Workshop',
      },
      {
        image:
          'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=85',
        description:
          'Build small tools for campus communities in a volunteer coding session. Bring a laptop and join a team; the club will help you find a useful project.',
        venue: 'Computer Science studio',
        category: 'Fundraiser',
      },
      {
        image:
          'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1200&q=85',
        description:
          'An informal meetup for coding questions, project partners and coffee. No presentation required.',
        venue: 'Library Café',
        category: 'Meeting',
      },
      {
        image:
          'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85',
        description:
          'Create and demo a small web app with support from club mentors. Bring a laptop; starter projects are available.',
        venue: 'Innovation Lab, Block B',
        category: 'Workshop',
      },
    ],
    canvas: [
      {
        image:
          'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=85',
        description:
          'An evening of sketching, sharing work and meeting the campus art community. Bring your sketchbook or use the club materials.',
        venue: 'Arts Studio',
        category: 'Social',
      },
      {
        image:
          'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=85',
        description:
          'A student art sale supporting the campus community fund. Browse handmade prints and meet the artists behind them.',
        venue: 'Student Union gallery',
        category: 'Fundraiser',
      },
      {
        image:
          'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?auto=format&fit=crop&w=1200&q=85',
        description:
          'Bring an unfinished page or start a new sketch with other students. A relaxed, free meetup for every skill level.',
        venue: 'Arts Studio',
        category: 'Meeting',
      },
      {
        image:
          'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=85',
        description:
          'Learn a simple printmaking technique and take home a handmade print. Materials are included in the workshop ticket.',
        venue: 'Print Studio, Arts Block',
        category: 'Workshop',
      },
    ],
  };
  const defaults = seed.events;
  club.events = club.events.map((event) => {
    const index = defaults.findIndex((original) => original.id === event.id);
    const theme = themes[clubId]?.[index];
    return theme && index >= 0 && event.description === defaults[index].description
      ? { ...event, ...theme }
      : event;
  });
  club.eventReviews ??= [];
  if (!club.events.some((event) => event.id === 'EVT-WELCOME-2026')) {
    club.events.push({
      id: 'EVT-WELCOME-2026',
      title: 'Welcome week: meet your community',
      date: '2026-09-12',
      time: '16:00',
      endTime: '19:00',
      venue: 'Student Union courtyard',
      category: 'Social',
      price: 0,
      memberPrice: 0,
      capacity: 80,
      sold: 0,
      description:
        'An afternoon of introductions, campus conversations and finding your next team. This completed demo event shows how an event stays useful after the doors close.',
      recap:
        'The welcome-week programme has finished. This sample archive is ready for the organizing team to add its highlights, photographs and attendee feedback. No attendance or reviews have been invented.',
      image:
        'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=85',
      gallery: [
        'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=85',
        'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=85',
        'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&q=85',
      ],
    });
  }
  return club;
}
