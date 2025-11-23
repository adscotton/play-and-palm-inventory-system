// src/pages/About.jsx
import Header from '../components/Header.jsx';
import Sidebar from '../components/Sidebar.jsx';
import '../styles/about.css';

const TEAM_MEMBERS = [
  {
    name: 'Kerr Lawrence T. Atabelo',
    role: 'Founder & CEO',
    bio: 'Sets vision and keeps the roadmap customer-first.',
    photo: 'AG',
  },
  {
    name: 'Adrian Lei M. Benedicto',
    role: 'CTO',
    bio: 'Builds resilient cloud architecture and data flows.',
    photo: 'JL',
  },
  {
    name: 'Alex Emmanuel C. Cadaoas',
    role: 'Lead Product',
    bio: 'Translates merchant needs into thoughtful experiences.',
    photo: 'PS',
  },
  {
    name: 'Steven W. Cai',
    role: 'Engineering Lead',
    bio: 'Ships APIs, integrations, and keeps performance tight.',
    photo: 'MT',
  },
  {
    name: 'Carl Justyn S. Iglesias',
    role: 'Design Lead',
    bio: 'Crafts the interface language and interaction system.',
    photo: 'EC',
  },
  {
    name: 'Keith Nicolai R. San Miguel',
    role: 'Customer Success',
    bio: 'Guides onboarding and makes sure teams get value fast.',
    photo: 'RC',
  },
];

export default function About() {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="app-content">
          <section className="about-hero card">
            <div>
              <p className="eyebrow">Play &amp; Palm IMS</p>
              <h1 className="about-title">Built for teams that care about every SKU</h1>
              <p className="about-description">
                We help retail and wholesale teams keep inventory accurate, predictable, and ready for customers.
                Our stack blends clean UX with dependable APIs so your operations stay calm even when demand spikes.
              </p>
            </div>
            <div className="about-pillars">
              <div className="pillar">
                <p className="pillar-title">Reliability</p>
                <p className="pillar-copy">Audit-friendly history, alerts, and backups that just work.</p>
              </div>
              <div className="pillar">
                <p className="pillar-title">Clarity</p>
                <p className="pillar-copy">Dashboards and exports that make sense to everyone on the floor.</p>
              </div>
              <div className="pillar">
                <p className="pillar-title">Speed</p>
                <p className="pillar-copy">Snappy UI, quick search, and data that arrives in real-time.</p>
              </div>
            </div>
          </section>

    
          <section className="team-section">
            <div className="team-header">
              <div>
                <p className="eyebrow">Team</p>
                <h2 className="team-title">The people behind the product</h2>
                <p className="team-description">
                  Six teammates with a mix of engineering, design, and operations backgrounds. We share a
                  common goal: make inventory feel simple and calm for your crews.
                </p>
              </div>
            </div>
            <div className="team-grid">
              {TEAM_MEMBERS.map((member) => (
                <div key={member.name} className="team-card">
                  <div className="avatar">{member.photo}</div>
                  <div className="team-text">
                    <h3 className="team-member-name">{member.name}</h3>
                    <p className="team-member-role">{member.role}</p>
                    <p className="team-member-bio">{member.bio}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
