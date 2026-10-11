import { parseRequest } from '../../shared/request-validation.js';
import {
  addMemberSchema,
  joinMembershipSchema,
  payDemoDuesSchema,
  approveMembershipSchema,
} from './membership.schemas.js';
import { HttpError, recordId } from '../../shared/records.js';
import { requireRole } from '../../shared/authorization.js';
import { ownMember } from '../../shared/validation.js';
import { ClubActionService } from '../clubs/club-action.service.js';

/** Legacy rows without the flag are treated as already approved. */
export function isJoinApproved(member) {
  return Boolean(member && member.joinApproved !== false);
}

export class MembershipService extends ClubActionService {
  addMember(input) {
    input = parseRequest(addMemberSchema, input);

    requireRole(this.role, ['admin']);
    const target = this.targetUser;
    if (!target)
      throw new HttpError(
        404,
        'This student must create an account before being added to the club.',
      );
    if (this.data.members.some((m) => m.userId === target.id))
      throw new HttpError(409, 'This student is already a member.');
    const active = input.member?.status === 'Active';
    this.data.members.push({
      id: target.id,
      userId: target.id,
      name: target.name,
      email: target.email,
      course: input.member.course || 'Campus community',
      role: ['Volunteer', 'Events lead', 'Treasurer', 'President'].includes(input.member?.role)
        ? input.member.role
        : 'Volunteer',
      status: active ? 'Active' : 'Pending',
      joined: this.now,
      expires: active ? `${Number(this.now.slice(0, 4)) + 1}-07-31` : this.now,
      whatsappOptIn: false,
      participationPoints: 0,
      volunteerPoints: 0,
      contributionPoints: 0,
      joinApproved: true,
    });
    if (active)
      this.data.transactions.unshift({
        id: recordId('TX'),
        title: `Membership dues · ${target.name} (simulated payment)`,
        category: 'Membership',
        amount: 500,
        date: this.now,
        status: 'Completed',
        createdBy: this.user.id,
        simulated: true,
      });

    return {};
  }

  join(input) {
    input = parseRequest(joinMembershipSchema, input);

    if (ownMember(this.data, this.user)) throw new HttpError(409, 'You already joined this club.');
    this.data.members.push({
      id: this.user.id,
      userId: this.user.id,
      name: this.user.name,
      email: this.user.email,
      course: input.course || 'Campus community',
      status: 'Pending',
      joined: this.now,
      expires: this.now,
      role: 'Volunteer',
      whatsappOptIn: false,
      participationPoints: 0,
      volunteerPoints: 0,
      contributionPoints: 0,
      joinApproved: false,
      enrollmentSource: 'self-join',
    });

    return {};
  }

  approve(input) {
    requireRole(this.role, ['admin']);
    const { memberId } = parseRequest(approveMembershipSchema, input);
    const member = this.data.members.find((m) => m.id === memberId || m.userId === memberId);
    if (!member) throw new HttpError(404, 'Membership request not found.');
    if (member.status === 'Active' && member.expires >= this.now)
      throw new HttpError(409, 'This membership is already active.');
    if (isJoinApproved(member) && member.status === 'Pending')
      throw new HttpError(409, 'This request is already approved. They can pay dues next.');
    member.joinApproved = true;
    member.status = 'Pending';
    this.data.notifications = [
      {
        id: recordId('NTF'),
        title: 'Join request approved',
        body: 'An administrator approved your club membership. Pay ₹500 dues from My card to activate benefits.',
        date: new Date().toISOString(),
        read: false,
        to: member.email,
        userId: member.userId,
      },
      ...(this.data.notifications || []),
    ].slice(0, 100);
    return { memberId: member.id };
  }

  payDemoDues(input) {
    input = parseRequest(payDemoDuesSchema, input);

    const member = input.memberId
      ? this.data.members.find((m) => m.id === input.memberId)
      : ownMember(this.data, this.user);
    if (!member) throw new HttpError(409, 'Join the club first.');
    if (member.userId !== this.user.id) requireRole(this.role, ['admin']);
    if (!isJoinApproved(member))
      throw new HttpError(
        403,
        'An administrator must approve your join request before you can pay dues.',
      );
    const expiryTime = member.expires ? new Date(`${member.expires}T23:59:59+05:30`).getTime() : 0;
    const nowTime = new Date(`${this.now}T00:00:00+05:30`).getTime();
    const daysUntilExpiry = member.expires
      ? Math.ceil((expiryTime - nowTime) / (24 * 60 * 60 * 1000))
      : 0;

    if (member.status === 'Active' && daysUntilExpiry > 7)
      throw new HttpError(409, 'Membership renewal is only available within 1 week of expiry.');

    const isRenewal = member.status === 'Active';
    const currentYear = Number((member.expires || this.now).slice(0, 4));
    const targetYear = Math.max(Number(this.now.slice(0, 4)), currentYear) + 1;
    member.status = 'Active';
    member.joinApproved = true;
    member.expires = `${targetYear}-07-31`;
    this.data.transactions.unshift({
      id: recordId('TX'),
      title: `${isRenewal ? 'Membership renewal' : 'Membership dues'} · ${member.name || this.user.name} (simulated payment)`,
      category: 'Membership',
      amount: 500,
      date: this.now,
      status: 'Completed',
      createdBy: this.user.id,
      simulated: true,
    });

    return {};
  }
}
