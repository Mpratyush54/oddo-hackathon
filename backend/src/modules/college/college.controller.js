import { HttpError } from '../../shared/records.js';

export function createCollegeController({ repo, clubs, domain }) {
  return {
    overview: async (req, res) => {
      const assignments = await repo.list(`USER#${req.auth.user.id}`, 'ACCESS#');
      if (!assignments.some((a) => a.role === 'college' && a.collegeId === 'skyline-campus'))
        throw new HttpError(403, 'College administrator access is required.');
      const participants = new Set();
      const summaries = await Promise.all(
        clubs.map(async (club) => {
          const { data } = await domain.load(club.id);
          data.members.forEach((m) => {
            if (m.userId) participants.add(m.userId);
          });
          return {
            ...club,
            memberCount: data.members.length,
            eventCount: data.events.length,
            upcomingCount: data.events.filter(
              (e) => new Date(`${e.date}T23:59:59+05:30`).getTime() > Date.now(),
            ).length,
            balance: data.transactions
              .filter((t) => t.status === 'Completed')
              .reduce((total, t) => total + t.amount, 0),
          };
        }),
      );
      res.json({
        collegeId: 'skyline-campus',
        uniqueParticipants: participants.size,
        clubs: summaries,
      });
    },
  };
}
