import { HttpError, recordId } from '../../shared/records.js';
import { requireRole } from '../../shared/authorization.js';
import { amount, ownMember } from '../../shared/validation.js';

export function handleMembership({ data, action, user, role, now, context, actor, args }) {
  let result = {};
  switch (action.type) {
    case 'members.add': {
      requireRole(role, ['admin']);
      const target = context.targetUser;
      if (!target)
        throw new HttpError(
          404,
          'This student must create an account before being added to the club.',
        );
      if (data.members.some((m) => m.userId === target.id))
        throw new HttpError(409, 'This student is already a member.');
      const active = args.member?.status === 'Active';
      data.members.push({
        id: target.id,
        userId: target.id,
        name: target.name,
        email: target.email,
        course: String(args.member?.course || 'Campus community').slice(0, 100),
        role: args.member?.role === 'Volunteer' ? 'Volunteer' : 'Member',
        status: active ? 'Active' : 'Pending',
        joined: now,
        expires: active ? `${Number(now.slice(0, 4)) + 1}-07-31` : now,
        whatsappOptIn: false,
        participationPoints: 0,
        volunteerPoints: 0,
        contributionPoints: 0,
      });
      if (active)
        data.transactions.unshift({
          id: recordId('TX'),
          title: `Membership dues · ${target.name} (simulated payment)`,
          category: 'Membership',
          amount: 500,
          date: now,
          status: 'Completed',
          createdBy: user.id,
          simulated: true,
        });
      break;
    }
    case 'membership.join': {
      if (ownMember(data, user)) throw new HttpError(409, 'You already joined this club.');
      data.members.push({
        id: user.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        course: String(args.course || 'Campus community').slice(0, 100),
        status: 'Pending',
        joined: now,
        expires: now,
        role: 'Member',
        whatsappOptIn: false,
        participationPoints: 0,
        volunteerPoints: 0,
        contributionPoints: 0,
      });
      break;
    }
    case 'membership.demo-dues': {
      const member = args.memberId
        ? data.members.find((m) => m.id === args.memberId)
        : ownMember(data, user);
      if (!member) throw new HttpError(409, 'Join the club first.');
      if (member.userId !== user.id) requireRole(role, ['admin']);
      if (member.status === 'Active' && member.expires >= now)
        throw new HttpError(409, 'This membership is already active.');
      member.status = 'Active';
      member.expires = `${Number(now.slice(0, 4)) + 1}-07-31`;
      data.transactions.unshift({
        id: recordId('TX'),
        title: `Membership dues · ${user.name} (simulated payment)`,
        category: 'Membership',
        amount: 500,
        date: now,
        status: 'Completed',
        createdBy: user.id,
        simulated: true,
      });
      break;
    }
  }
  return { data, result };
}
