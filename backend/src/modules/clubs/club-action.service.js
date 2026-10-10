// A fresh service instance belongs to one action. It never shares user/state data across requests.
export class ClubActionService {
  constructor({ data, user, role, now, clubId, targetUser }) {
    this.data = data;
    this.user = user;
    this.role = role;
    this.now = now;
    this.clubId = clubId;
    this.targetUser = targetUser;
    this.actor = { id: user.id, name: user.name, email: user.email };
  }
}
