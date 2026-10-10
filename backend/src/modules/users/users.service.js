import { HttpError, clubKey, recordId, timestamp, dateToday } from '../../shared/records.js';
import { requireRole } from '../../shared/authorization.js';
import { accountKey } from '../auth/password.js';
import { visibleState } from '../clubs/club.views.js';
import { parseRequest } from '../../shared/request-validation.js';
import { userUpdateSchema, userRemoveSchema, userLookupSchema } from './users.schemas.js';

// Club administrators manage only their club, never another club's access or global accounts.
export class UsersService {
  constructor({ repo, domain }) {
    this.repo = repo;
    this.domain = domain;
  }
  async authorize(user, clubId) {
    requireRole(await this.domain.roleFor(user, clubId), ['admin']);
  }
  async list(user, clubId) {
    await this.authorize(user, clubId);
    const current = await this.domain.load(clubId);
    return Promise.all(
      current.data.members.map(async (member) => {
        const profile = member.userId
          ? await this.repo.get('USER#' + member.userId, 'PROFILE')
          : null;
        const role = profile ? await this.domain.roleFor(profile, clubId) : 'member';
        return {
          ...member,
          userId: profile?.id || '',
          emailVerified: !!profile?.emailVerified,
          accessRole: role,
        };
      }),
    );
  }
  async lookup(user, clubId, email) {
    ({ email } = parseRequest(userLookupSchema, { email }));
    await this.authorize(user, clubId);
    const account = await this.repo.get(accountKey(email), 'ACCOUNT');
    const target = account && (await this.repo.get('USER#' + account.id, 'PROFILE'));
    if (!target || target.disabled)
      throw new HttpError(404, 'This person must create an account first.');
    return {
      userId: target.id,
      name: target.name,
      email: target.email,
      emailVerified: !!target.emailVerified,
    };
  }
  async update(user, clubId, input) {
    input = parseRequest(userUpdateSchema, input);
    return this.change(user, clubId, input, false);
  }
  async remove(user, clubId, input) {
    input = parseRequest(userRemoveSchema, input);
    return this.change(user, clubId, input, true);
  }
  async change(user, clubId, input, remove) {
    await this.authorize(user, clubId);
    if (input.userId === user.id && (remove || input.role !== 'admin'))
      throw new HttpError(409, 'You cannot remove or demote your own administrator access.');
    const target = await this.repo.get('USER#' + input.userId, 'PROFILE');
    if (!target || target.disabled) throw new HttpError(404, 'User account not found.');
    const existingRole = await this.domain.roleFor(target, clubId);
    if (!remove && input.role !== 'member' && input.role !== existingRole && !target.emailVerified)
      throw new HttpError(409, 'This user must verify their email before receiving a staff role.');
    if (existingRole === 'college')
      throw new HttpError(403, 'College access must be managed by the college administrator.');
    if (!remove && ['Active', 'Expiring'].includes(input.status) && input.expires < dateToday())
      throw new HttpError(400, 'Active membership must have a current or future expiry date.');
    for (let attempt = 0; attempt < 5; attempt++) {
      const actorAccess = await this.repo.get('USER#' + user.id, 'ACCESS#' + clubId);
      requireRole(actorAccess?.role, ['admin']);
      const current = await this.domain.load(clubId);
      const data = structuredClone(current.data);
      const index = data.members.findIndex((m) => m.userId === target.id);
      if (remove && index < 0) throw new HttpError(404, 'This user is not in the club.');
      if (remove) data.members.splice(index, 1);
      else {
        const previous = data.members[index];
        const member = {
          ...(previous || {
            id: target.id,
            userId: target.id,
            joined: dateToday(),
            whatsappOptIn: false,
          }),
          name: target.name,
          email: target.email,
          course: input.course,
          role: input.memberRole,
          status: input.status,
          expires: input.expires,
          // Admin activation is complimentary. It must never invent a payment.
          duesWaived: ['Active', 'Expiring'].includes(input.status)
            ? true
            : previous?.duesWaived || false,
        };
        if (index < 0) data.members.push(member);
        else data.members[index] = member;
      }
      const audit = {
        id: recordId('AUD'),
        actor: user.id,
        clubId,
        collegeId: 'skyline-campus',
        action: remove ? 'users.remove' : 'users.update',
        entity: 'users',
        entityId: target.id,
        date: timestamp(),
        detail: remove
          ? `${user.name} removed ${target.name} from the club.`
          : `${user.name} updated ${target.name}: ${input.role}, ${input.status}, expires ${input.expires} (complimentary activation).`,
      };
      data.audit = [audit, ...(data.audit || [])].slice(0, 100);
      if (Buffer.byteLength(JSON.stringify(data)) > 300000)
        throw new HttpError(409, 'Club data limit reached.');
      if (
        await this.repo.atomic([
          {
            item: { pk: clubKey(clubId), sk: 'STATE', version: current.version + 1, data },
            condition: '#version = :version',
            names: { '#version': 'version' },
            values: { ':version': current.version },
          },
          {
            item: {
              pk: 'USER#' + target.id,
              sk: 'ACCESS#' + clubId,
              clubId,
              role: remove ? 'member' : input.role,
            },
            ...(target.id === user.id
              ? {
                  condition: '#role = :role',
                  names: { '#role': 'role' },
                  values: { ':role': 'admin' },
                }
              : {}),
          },
          ...(target.id !== user.id
            ? [
                {
                  item: actorAccess,
                  condition: '#role = :role',
                  names: { '#role': 'role' },
                  values: { ':role': 'admin' },
                },
              ]
            : []),
          {
            item: { pk: clubKey(clubId), sk: `AUDIT#${audit.date}#${audit.id}`, ...audit },
            condition: 'attribute_not_exists(pk)',
          },
        ])
      )
        return { state: visibleState(data, user, 'admin') };
    }
    throw new HttpError(409, 'Another update is in progress. Reload and try again.');
  }
}
