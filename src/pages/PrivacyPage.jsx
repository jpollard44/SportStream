import { Link } from 'react-router-dom'

const LAST_UPDATED = 'March 22, 2026'
const CONTACT_EMAIL = 'jordan@sportstream.app'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <Link to="/" className="text-lg font-extrabold tracking-tight">
          Sport<span className="text-blue-500">Stream</span>
        </Link>
        <Link to="/login" className="text-sm text-gray-400 hover:text-white transition">Sign in</Link>
      </nav>

      <div className="mx-auto max-w-2xl px-5 py-12">
        <h1 className="mb-2 text-3xl font-extrabold text-white">Privacy Policy</h1>
        <p className="mb-10 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-8 text-gray-300 leading-relaxed">

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">1. What data we collect</h2>
            <p className="text-sm">
              When you use SportStream, we collect the following types of information:
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span><strong className="text-white">Account information</strong> — your email address, display name, and (if you sign in with Google) your Google profile picture.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span><strong className="text-white">Game and stats data</strong> — play-by-play events, scores, and player statistics you record during games.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span><strong className="text-white">Uploaded media</strong> — team logos and player photos you upload to your profile or team page.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span><strong className="text-white">Device and usage data</strong> — push notification tokens (FCM) so we can send you live-game alerts, and local storage preferences (e.g. install prompt dismissal).</span></li>
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span><strong className="text-white">Contact information you provide voluntarily</strong> — player email addresses and phone numbers added to your roster are stored securely and are only visible to club administrators.</span></li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">2. How we use your data</h2>
            <ul className="mt-1 space-y-2 text-sm">
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span>Displaying your player profile, career stats, and game history on public team and player pages.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span>Sending push notifications (e.g. when a team you follow goes live, or a game you're following ends) via Firebase Cloud Messaging.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span>Generating automated highlight cards for notable plays (home runs, 3-pointers, goals, etc.).</span></li>
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span>Computing league standings and tournament brackets.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span>Processing payments for plan upgrades via ChipInPool (we do not store card numbers).</span></li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">3. Data processors</h2>
            <p className="text-sm">
              SportStream is built on <strong className="text-white">Firebase</strong> (Google LLC), which acts as our primary data processor. Your data is stored in Firestore databases and Firebase Storage, and authentication is handled by Firebase Auth. Google's privacy policy applies to data processed through Firebase:{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                policies.google.com/privacy
              </a>.
            </p>
            <p className="mt-3 text-sm">
              We use <strong className="text-white">ChipInPool</strong> for payment processing. Refer to their privacy policy for details on how they handle financial data.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">4. Public data</h2>
            <p className="text-sm">
              Player profiles, game scores, play-by-play feeds, and team pages are publicly visible without an account. When you record plays or appear on a roster, your name, jersey number, and stats may be visible to anyone with the link. If you do not want your data public, contact us to have your profile removed.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">5. Your rights</h2>
            <ul className="mt-1 space-y-2 text-sm">
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span><strong className="text-white">Access</strong> — you can view all data associated with your account on your profile and settings pages.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span><strong className="text-white">Correction</strong> — you can update your display name and player profile at any time in Settings or on your player page.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span><strong className="text-white">Deletion</strong> — deleting your account (Settings → Danger Zone) removes your authentication record. Your clubs and game records are preserved so other members' stats are not lost, but your personal profile is unlinked.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span><strong className="text-white">Opt out of notifications</strong> — you can disable push notifications at any time in Settings → Notifications.</span></li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">6. Data retention</h2>
            <p className="text-sm">
              We retain your data for as long as your account is active. If you delete your account, your authentication data is removed immediately. Anonymised game records and stats may be retained indefinitely to preserve historical records for other players.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">7. Cookies and local storage</h2>
            <p className="text-sm">
              SportStream uses browser local storage (not traditional cookies) to persist your session, store preferences (such as voice announcements and install prompt dismissal), and track your visit count for the PWA install prompt. We do not use third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">8. Children's privacy</h2>
            <p className="text-sm">
              SportStream is not directed at children under 13. If you believe a child has provided personal information without parental consent, please contact us and we will remove it promptly.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">9. Changes to this policy</h2>
            <p className="text-sm">
              We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date at the top of this page. Continued use of SportStream after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">10. Contact us</h2>
            <p className="text-sm">
              If you have questions or requests regarding your privacy, please email us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-400 hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </section>
        </div>

        {/* Footer links */}
        <div className="mt-12 flex flex-wrap gap-4 border-t border-white/5 pt-8 text-sm text-gray-500">
          <Link to="/terms" className="hover:text-gray-300 transition">Terms of Service</Link>
          <Link to="/" className="hover:text-gray-300 transition">← Home</Link>
        </div>
      </div>
    </div>
  )
}
