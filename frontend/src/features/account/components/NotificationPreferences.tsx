import { useEffect, useState } from 'react';
import { phoneSchema } from '../../../../../shared/schemas.js';
import { Button } from '../../../shared/ui/Button';
import { CardHeader } from '../../../shared/ui/CardHeader';
import { Field } from '../../../shared/ui/Field';
import { useStore } from '../../../app/state/StoreProvider';
import '../../../shared/styles/portal.css';
import '../../landing/styles/landing.css';
import { usePersonal } from '../hooks/usePersonal';

export function NotificationPreferences() {
  const { member } = usePersonal();
  const { update, toast } = useStore();
  const [phone, setPhone] = useState(member?.phone || '');
  const [optIn, setOptIn] = useState(!!member?.whatsappOptIn);
  const [error, setError] = useState('');
  useEffect(() => {
    setPhone(member?.phone || '');
    setOptIn(!!member?.whatsappOptIn);
  }, [member?.id, member?.phone, member?.whatsappOptIn]);
  return (
    <section className="portal-panel portal-latest">
      <CardHeader title="Keep me in the loop" subtitle="Choose how your club can reach you." />
      {member ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (optIn && !phoneSchema.safeParse(phone.trim()).success) {
              setError('Enter a phone number with country code, for example +919876543210.');
              return;
            }
            setError('');
            update((d) => ({
              ...d,
              members: d.members.map((m) =>
                m.id === member.id ? { ...m, phone: phone.trim(), whatsappOptIn: optIn } : m,
              ),
            }));
            toast('Preferences saved. WhatsApp sending requires a configured provider.');
          }}
        >
          <div className="portal-consent-fields">
            <Field label="WhatsApp phone number" hint="Include your country code.">
              <input
                type="tel"
                placeholder="+919876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <label className="portal-consent-check">
              <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
              <span>
                I agree to receive club announcements and membership reminders on WhatsApp. I can
                turn this off at any time.
              </span>
            </label>
          </div>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" icon="Check">
            Save preferences
          </Button>
          <p className="portal-muted portal-consent-hint">
            Consent is saved locally for this demo. No WhatsApp message is sent from this form.
          </p>
        </form>
      ) : (
        <p className="portal-muted">
          Join this club to manage your membership communication preferences.
        </p>
      )}
    </section>
  );
}
