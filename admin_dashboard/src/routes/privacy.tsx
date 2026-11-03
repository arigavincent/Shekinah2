import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "../public-pages/PublicPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy · Shekinah Sons Global" }] }),
  component: Privacy,
});

function Privacy() {
  return (
    <PublicPage title="Privacy Policy">
      <p><em>Last updated: 2 November 2026</em></p>
      <p>
        This policy explains what the Shekinah Sons Global app and website collect, why, who it is shared with, and the choices you
        have. Shekinah Sons Global ("the church", "we") is responsible for this information under Kenya's Data Protection Act, 2019.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Your account:</strong> name, email address, phone number and password (stored only as a secure one-way hash).</li>
        <li><strong>What you share:</strong> prayer requests, testimonies, community and live-chat messages, event registrations and their answers, serve-team requests.</li>
        <li><strong>Attendance:</strong> check-ins at services and events (when and how you checked in).</li>
        <li><strong>Giving and purchases:</strong> amount, purpose, payment method and reference, and the phone number or name used to pay. Card details are handled by the payment provider and never reach us.</li>
        <li><strong>Notifications:</strong> a device token so we can send the notifications you allow.</li>
        <li><strong>On your phone only:</strong> where you stopped in each sermon, saved items, Bible highlights and notes, and downloads (sermons and books are stored encrypted).</li>
        <li><strong>Live broadcasts:</strong> if you are allowed to broadcast, the camera and microphone are used only while you are live, and the service is recorded for the church's replays.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To run your account and the app's features: sermons, live services, Bible, reading plans, events, giving and community.</li>
        <li>To care for members: the pastoral team sees prayer requests and can follow up; phone numbers appear on check-ins and attendance lists.</li>
        <li>To keep records of gifts and payments, as required for the church's accounts.</li>
        <li>To keep the community safe: moderation of chat, prayer requests and testimonies.</li>
      </ul>
      <p>We do not sell your information or use it for advertising.</p>

      <h2>Who it is shared with</h2>
      <p>Only with services that run the app for us, under their own security and privacy terms:</p>
      <ul>
        <li>Hosting and storage (our servers and cloud storage providers, including Cloudflare).</li>
        <li>Google Firebase, to deliver push notifications.</li>
        <li>Payment providers (Safaricom M-Pesa, and a card processor if you pay by card).</li>
        <li>YouTube, when you play a sermon that is published on YouTube (YouTube's own privacy policy applies to that video).</li>
      </ul>
      <p>We may also share information when the law requires it.</p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Your account and what you shared: until you delete your account.</li>
        <li>Public prayer requests leave the Prayer Wall after 30 days and are deleted a year later.</li>
        <li>Gift and payment records: as long as the church's accounting and legal duties require, without your personal details after you delete your account.</li>
      </ul>

      <h2>Your choices and rights</h2>
      <ul>
        <li>See and correct your details in the app (Profile).</li>
        <li>Post prayer requests privately or anonymously.</li>
        <li>Turn notifications off in the app or in your phone's settings.</li>
        <li>
          <strong>Delete your account</strong> at any time: in the app under Profile → <em>Delete my account</em>, or on the web at{" "}
          <a href="/delete-account">delete your account</a>. This deletes your profile, prayer requests, testimonies, chat messages,
          playlists and saved items.
        </li>
        <li>You may also ask the church for a copy of your information or object to its use, and complain to Kenya's Office of the Data Protection Commissioner.</li>
      </ul>

      <h2>Children</h2>
      <p>The app is meant for the church family. Children under 13 should use it with a parent or guardian, who may contact us to remove a child's information.</p>

      <h2>Security</h2>
      <p>Connections are encrypted (HTTPS), passwords are hashed, staff accounts can use two-step sign-in, and downloaded sermons and books are encrypted on your phone.</p>

      <h2>Contact</h2>
      <p>For any privacy question or request, contact Shekinah Sons Global through the app's <em>About &amp; Contact</em> page.</p>

      <h2>Changes</h2>
      <p>If this policy changes, the new version will be posted here with a new date.</p>
    </PublicPage>
  );
}
