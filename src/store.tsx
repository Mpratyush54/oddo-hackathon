import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type Member = { id: string; name: string; email: string; course: string; status: 'Active' | 'Pending' | 'Expiring'; joined: string; expires: string; role: string };
export type ClubEvent = { id: string; title: string; date: string; time: string; venue: string; category: string; price: number; memberPrice: number; capacity: number; sold: number; description: string; image: string };
export type Transaction = { id: string; title: string; category: string; amount: number; date: string; status: 'Completed' | 'Pending'; receipt?: string; receiptData?: string };
export type Task = { id: string; title: string; description: string; assignee: string; due: string; priority: string; status: 'To do' | 'In progress' | 'Done' };
export type Product = { id: string; name: string; price: number; memberPrice: number; color: string; type: string; stock: Record<string, number> };
export type Announcement = { id: string; title: string; body: string; audience: string; date: string; author: string; read: number; email: boolean };
export type Ticket = { id: string; eventId: string; name: string; email: string; member: boolean; checkedIn: boolean; amount: number };
export type Order = { id: string; productId: string; name: string; size: string; amount: number; date: string };
export type Store = { members: Member[]; events: ClubEvent[]; transactions: Transaction[]; tasks: Task[]; products: Product[]; announcements: Announcement[]; tickets: Ticket[]; orders: Order[]; profile: { name: string; email: string; role: string }; preferences: { email: boolean; renewals: boolean; weekly: boolean } };
export const today = '2026-10-10';
export const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
export const date = (value: string, options?: Intl.DateTimeFormatOptions) => new Date(value + (value.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-GB', options || { day: 'numeric', month: 'short', year: 'numeric' });
export const uid = (prefix = 'ID') => `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
export function exportCSV(name: string, rows: (string | number | boolean)[][]) {
  const content = '\uFEFF' + rows.map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export const seed: Store = {
  profile: { name: 'Alex Morgan', email: 'alex@skyline.edu', role: 'Club president' },
  preferences: { email: true, renewals: true, weekly: false },
  members: [
    { id: 'MEM-001', name: 'Alex Morgan', email: 'alex@skyline.edu', course: 'Computer Science', status: 'Active', joined: '2026-08-12', expires: '2027-07-31', role: 'President' },
    { id: 'MEM-002', name: 'Priya Sharma', email: 'priya@skyline.edu', course: 'Business Administration', status: 'Active', joined: '2026-08-14', expires: '2027-07-31', role: 'Treasurer' },
    { id: 'MEM-003', name: 'Jordan Lee', email: 'jordan@skyline.edu', course: 'Visual Communication', status: 'Active', joined: '2026-08-18', expires: '2027-07-31', role: 'Events lead' },
    { id: 'MEM-004', name: 'Sam Wilson', email: 'sam@skyline.edu', course: 'Mechanical Engineering', status: 'Pending', joined: '2026-10-08', expires: '2027-07-31', role: 'Member' },
    { id: 'MEM-005', name: 'Aisha Patel', email: 'aisha@skyline.edu', course: 'Economics', status: 'Active', joined: '2026-09-02', expires: '2027-07-31', role: 'Volunteer' },
    { id: 'MEM-006', name: 'Ryan Chen', email: 'ryan@skyline.edu', course: 'Computer Science', status: 'Expiring', joined: '2025-10-20', expires: '2026-10-20', role: 'Member' },
    { id: 'MEM-007', name: 'Maya Johnson', email: 'maya@skyline.edu', course: 'Psychology', status: 'Pending', joined: '2026-10-09', expires: '2027-07-31', role: 'Member' },
    { id: 'MEM-008', name: 'Noah Williams', email: 'noah@skyline.edu', course: 'Media Studies', status: 'Active', joined: '2026-09-12', expires: '2027-07-31', role: 'Volunteer' },
    { id: 'MEM-009', name: 'Emma Davis', email: 'emma@skyline.edu', course: 'Architecture', status: 'Expiring', joined: '2025-10-24', expires: '2026-10-24', role: 'Member' },
    { id: 'MEM-010', name: 'Arjun Mehta', email: 'arjun@skyline.edu', course: 'Mathematics', status: 'Active', joined: '2026-09-15', expires: '2027-07-31', role: 'Member' },
    { id: 'MEM-011', name: 'Olivia Brown', email: 'olivia@skyline.edu', course: 'Literature', status: 'Active', joined: '2026-09-18', expires: '2027-07-31', role: 'Member' },
    { id: 'MEM-012', name: 'Ethan Taylor', email: 'ethan@skyline.edu', course: 'Design', status: 'Pending', joined: '2026-10-10', expires: '2027-07-31', role: 'Member' },
  ],
  events: [
    { id: 'EVT-001', title: 'The Skyline Gala', date: '2026-10-24', time: '18:00', venue: 'The Grand Hall, Campus East', category: 'Social', price: 750, memberPrice: 500, capacity: 180, sold: 126, description: 'An evening to remember. Join your Skyline community for live music, a three-course dinner, and a celebration of everything we have built together. Dress up, bring a friend, and make some memories.', image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1000&q=85' },
    { id: 'EVT-002', title: 'Bake a difference', date: '2026-10-16', time: '10:00', venue: 'Student Union Courtyard', category: 'Fundraiser', price: 0, memberPrice: 0, capacity: 120, sold: 48, description: 'Good bakes for a great cause. Our student-led bake sale supports the campus community fund. Come for the cookies, stay for the conversation.', image: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=1000&q=85' },
    { id: 'EVT-003', title: 'Ideas & iced coffee', date: '2026-10-14', time: '16:30', venue: 'Library Café', category: 'Meeting', price: 0, memberPrice: 0, capacity: 40, sold: 28, description: 'Our monthly community catch-up. Share ideas for the next semester, meet the committee, and enjoy a coffee on us. Everyone is welcome.', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=85' },
    { id: 'EVT-004', title: 'Build your next big thing', date: '2026-11-06', time: '14:00', venue: 'Innovation Lab, Block B', category: 'Workshop', price: 250, memberPrice: 150, capacity: 60, sold: 18, description: 'A hands-on design thinking workshop for curious minds. Turn an idea into a prototype with mentors from across campus. No experience needed.', image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1000&q=85' },
  ],
  transactions: [
    { id: 'TX-001', title: 'Annual membership dues', category: 'Membership', amount: 42000, date: '2026-08-20', status: 'Completed' },
    { id: 'TX-002', title: 'Welcome week supplies', category: 'Expenses', amount: -4800, date: '2026-08-22', status: 'Completed', receipt: 'welcome-week.pdf' },
    { id: 'TX-003', title: 'Club T-shirt orders', category: 'Merchandise', amount: 8400, date: '2026-09-05', status: 'Completed' },
    { id: 'TX-004', title: 'Print & production', category: 'Expenses', amount: -6200, date: '2026-09-08', status: 'Completed', receipt: 'printing.pdf' },
    { id: 'TX-005', title: 'Community fundraiser', category: 'Fundraiser', amount: 7600, date: '2026-09-18', status: 'Completed' },
    { id: 'TX-006', title: 'The Skyline Gala · ticket sales', category: 'Tickets', amount: 18500, date: '2026-10-02', status: 'Completed' },
    { id: 'TX-007', title: 'Gala venue deposit', category: 'Expenses', amount: -15000, date: '2026-10-03', status: 'Completed', receipt: 'venue-deposit.pdf' },
    { id: 'TX-008', title: 'Skyline hoodie orders', category: 'Merchandise', amount: 6600, date: '2026-10-08', status: 'Completed' },
    { id: 'TX-009', title: 'Bake sale supplies · Aisha', category: 'Expenses', amount: -1250, date: '2026-10-09', status: 'Pending', receipt: 'supplies.jpg' },
    { id: 'TX-010', title: 'Poster printing · Jordan', category: 'Expenses', amount: -850, date: '2026-10-10', status: 'Pending', receipt: 'posters.pdf' },
  ],
  tasks: [
    { id: 'TASK-001', title: 'Order ingredients & supplies', description: 'Flour, chocolate, butter, and recyclable packaging.', assignee: 'Aisha Patel', due: '2026-10-13', priority: 'High', status: 'To do' },
    { id: 'TASK-002', title: 'Confirm volunteer shifts', description: 'Organize two-hour shifts for the bake sale table.', assignee: 'Alex Morgan', due: '2026-10-14', priority: 'Medium', status: 'To do' },
    { id: 'TASK-003', title: 'Design the fundraiser posters', description: 'A4 posters and a square social media post.', assignee: 'Jordan Lee', due: '2026-10-12', priority: 'High', status: 'In progress' },
    { id: 'TASK-004', title: 'Bake cookies & brownies', description: 'Prepare 60 portions. Include a vegan option.', assignee: 'Noah Williams', due: '2026-10-15', priority: 'Medium', status: 'In progress' },
    { id: 'TASK-005', title: 'Book the courtyard table', description: 'Confirm with the Student Union office.', assignee: 'Priya Sharma', due: '2026-10-08', priority: 'Low', status: 'Done' },
    { id: 'TASK-006', title: 'Set the fundraiser budget', description: 'Approved supplies budget: ₹2,000.', assignee: 'Priya Sharma', due: '2026-10-09', priority: 'Medium', status: 'Done' },
  ],
  products: [
    { id: 'PROD-001', name: 'The everyday hoodie', type: 'Hoodie', price: 1200, memberPrice: 999, color: 'teal', stock: { S: 8, M: 12, L: 6, XL: 4 } },
    { id: 'PROD-002', name: 'Wear your community', type: 'T-shirt', price: 600, memberPrice: 499, color: 'cream', stock: { S: 10, M: 14, L: 9, XL: 0 } },
    { id: 'PROD-003', name: 'A little carry-all', type: 'Tote bag', price: 450, memberPrice: 350, color: 'green', stock: { 'One size': 18 } },
  ],
  announcements: [
    { id: 'ANN-001', title: 'Something special is on the calendar ✨', body: 'The Skyline Gala is officially happening on October 24! Tickets are now live, and members get an exclusive ₹250 discount. Bring your friends and join us for our biggest night of the semester.', audience: 'All members', date: '2026-10-09', author: 'Jordan Lee', read: 9, email: true },
    { id: 'ANN-002', title: 'Calling all bakers (and taste testers)', body: 'Our community bake sale is next Friday. We are looking for a few more helping hands! Check the project board to find a task that works for you. Every little contribution makes a difference.', audience: 'Volunteers', date: '2026-10-07', author: 'Aisha Patel', read: 5, email: true },
    { id: 'ANN-003', title: 'Your ideas belong here', body: 'Come along to our monthly meeting at the Library Café on October 14. Whether you have a big idea or just want to say hi, there is a seat for you. Coffee is on us.', audience: 'All members', date: '2026-10-05', author: 'Alex Morgan', read: 10, email: false },
  ],
  tickets: [
    { id: 'SKY-1001', eventId: 'EVT-001', name: 'Priya Sharma', email: 'priya@skyline.edu', member: true, checkedIn: false, amount: 500 },
    { id: 'SKY-1002', eventId: 'EVT-001', name: 'Jordan Lee', email: 'jordan@skyline.edu', member: true, checkedIn: true, amount: 500 },
    { id: 'SKY-1003', eventId: 'EVT-001', name: 'Sam Wilson', email: 'sam@skyline.edu', member: false, checkedIn: false, amount: 750 },
  ],
  orders: [],
};
type ContextValue = { data: Store; update: (fn: (current: Store) => Store) => void; toast: (message: string) => void; toastMessage: string; clearToast: () => void };
const StoreContext = createContext<ContextValue | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Store>(() => { try { const saved = localStorage.getItem('skyline-v1'); return saved ? { ...seed, ...JSON.parse(saved) } : structuredClone(seed); } catch { return structuredClone(seed); } });
  const [toastMessage, setToastMessage] = useState('');
  useEffect(() => { try { localStorage.setItem('skyline-v1', JSON.stringify(data)); } catch { setToastMessage('Your browser could not save changes. Check your storage settings.'); } }, [data]);
  useEffect(() => { if (!toastMessage) return; const timer = setTimeout(() => setToastMessage(''), 4500); return () => clearTimeout(timer); }, [toastMessage]);
  return <StoreContext.Provider value={{ data, update: setData, toast: setToastMessage, toastMessage, clearToast: () => setToastMessage('') }}>{children}</StoreContext.Provider>;
}
export const useStore = () => { const context = useContext(StoreContext); if (!context) throw new Error('StoreProvider is required'); return context; };
