import { parseRequest } from '../../shared/request-validation.js';
import { addMemberSchema, joinMembershipSchema, payDemoDuesSchema } from './membership.schemas.js';
import { HttpError, recordId } from '../../shared/records.js';
import { requireRole } from '../../shared/authorization.js';
import { ownMember } from '../../shared/validation.js';
import { ClubActionService } from '../clubs/club-action.service.js';

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
      role: input.member?.role === 'Volunteer' ? 'Volunteer' : 'Member',
      status: active ? 'Active' : 'Pending',
      joined: this.now,
      expires: active ? `${Number(this.now.slice(0, 4)) + 1}-07-31` : this.now,
      whatsappOptIn: false,
      participationPoints: 0,
      volunteerPoints: 0,
      contributionPoints: 0,
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
      role: 'Member',
      whatsappOptIn: false,
      participationPoints: 0,
      volunteerPoints: 0,
      contributionPoints: 0,
    });

    return {};
  }

  payDemoDues(input) {
    input = parseRequest(payDemoDuesSchema, input);

    const member = input.memberId
      ? this.data.members.find((m) => m.id === input.memberId)
      : ownMember(this.data, this.user);
    if (!member) throw new HttpError(409, 'Join the club first.');
    if (member.userId !== this.user.id) requireRole(this.role, ['admin']);
    if (member.status === 'Active' && member.expires >= this.now)
      throw new HttpError(409, 'This membership is already active.');
    member.status = 'Active';
    member.expires = `${Number(this.now.slice(0, 4)) + 1}-07-31`;
    this.data.transactions.unshift({
      id: recordId('TX'),
      title: `Membership dues · ${this.user.name} (simulated payment)`,
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
