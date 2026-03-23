import { Link } from 'react-router-dom'

const LAST_UPDATED = 'March 22, 2026'
const CONTACT_EMAIL = 'jordan@sportstream.app'

export default function TermsPage() {
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
        <h1 className="mb-2 text-3xl font-extrabold text-white">Terms of Service</h1>
        <p className="mb-10 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-8 text-gray-300 leading-relaxed">

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">1. Acceptance of terms</h2>
            <p className="text-sm">
              By creating a SportStream account or using any part of the platform, you agree to be bound by these Terms of Service. If you do not agree, please do not use SportStream.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">2. Use of the service</h2>
            <p className="text-sm">SportStream is a platform for recording and sharing sports scores, stats, and highlights for recreational, school, and amateur teams. You agree to:</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span>Only record scores and stats for games you are authorised to keep score for.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span>Not use the platform to harass, defame, or misrepresent other users or players.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span>Not attempt to access other users' accounts, manipulate game data, or interfere with the platform's operation.</span></li>
              <li className="flex gap-2"><span className="text-blue-400 shrink-0">•</span> <span>Not use the platform for any commercial purpose not expressly permitted by SportStream.</span></li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">3. User-submitted content</h2>
            <p className="text-sm">
              You retain ownership of content you submit (photos, player names, game data). By submitting content, you grant SportStream a worldwide, royalty-free licence to display, reproduce, and distribute that content within the platform. You represent that you have the right to submit the content and that it does not infringe any third-party rights.
            </p>
            <p className="mt-3 text-sm">
              SportStream may display your user-submitted content (including player highlights) publicly on team pages, the Wall of Fame, and in push notifications sent to followers.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">4. Accuracy of sports data</h2>
            <p className="text-sm">
              SportStream is a crowd-sourced platform. Game scores and statistics are entered manually by scorekeepers and are not verified by SportStream. <strong className="text-white">We make no warranties about the accuracy, completeness, or timeliness of any sports data on the platform.</strong> Do not rely on SportStream data for official record-keeping, officiating decisions, or any purpose requiring certified accuracy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">5. Payments and subscriptions</h2>
            <p className="text-sm">
              Paid plans (Team and Premium) are billed monthly through ChipInPool. Subscriptions automatically renew unless cancelled. You may request cancellation by emailing{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-400 hover:underline">{CONTACT_EMAIL}</a>.
              No refunds are provided for partial billing periods. Entry fees for tournaments and leagues are collected through ChipInPool and are subject to ChipInPool's terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">6. Disclaimer of warranties</h2>
            <p className="text-sm">
              SportStream is provided "as is" without warranties of any kind, express or implied. We do not warrant that the service will be uninterrupted, error-free, or free of viruses. Your use of the service is at your sole risk.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">7. Limitation of liability</h2>
            <p className="text-sm">
              To the fullest extent permitted by law, SportStream and its operators shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the platform, including but not limited to loss of data or revenue.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">8. Termination</h2>
            <p className="text-sm">
              SportStream reserves the right to suspend or terminate your account at any time if you violate these terms or engage in conduct that harms other users or the platform. You may delete your account at any time via Settings → Danger Zone.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">9. Changes to these terms</h2>
            <p className="text-sm">
              We may update these terms from time to time. Continued use of the platform after changes are posted constitutes acceptance. We will update the "Last updated" date when changes are made.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">10. Governing law</h2>
            <p className="text-sm">
              These terms are governed by the laws of the jurisdiction in which SportStream operates. Any disputes shall be resolved through good-faith negotiation; if unresolved, through binding arbitration.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-bold text-white">11. Contact</h2>
            <p className="text-sm">
              For questions about these terms, email us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-400 hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </section>
        </div>

        {/* Footer links */}
        <div className="mt-12 flex flex-wrap gap-4 border-t border-white/5 pt-8 text-sm text-gray-500">
          <Link to="/privacy" className="hover:text-gray-300 transition">Privacy Policy</Link>
          <Link to="/" className="hover:text-gray-300 transition">← Home</Link>
        </div>
      </div>
    </div>
  )
}
