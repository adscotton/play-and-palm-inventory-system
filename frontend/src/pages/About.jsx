// src/pages/About.jsx
import Header from '../components/Header.jsx';
import Sidebar from '../components/Sidebar.jsx';
import '../styles/about.css';
import adrianImg from '../utils/adrian.jpg';
import alexImg from '../utils/alex.jpg';
import justynImg from '../utils/justyn.png';
import keithImg from '../utils/keith.jpg';
import kerrImg from '../utils/kerr.jpg';
import stevenImg from '../utils/steven.JPG';

const TEAM_MEMBERS = [
  {
    name: 'Adrian Lei M. Benedicto',
    role: 'Project Manager',
    bio: 'Leads the project with a focus on delivery and team synergy.',
    photo: adrianImg,
  },
  {
    name: 'Alex Emmanuel C. Cadaoas',
    role: 'Frontend Engineer',
    bio: 'Develops user interfaces with a keen eye for detail and usability.',
    photo: alexImg,
  },
  {
    name: 'Steven W. Cai',
    role: 'Backend Engineer',
    bio: 'Builds robust server-side logic and database management.',
    photo: stevenImg,
  },
  {
    name: 'Carl Justyn S. Iglesias',
    role: 'Quality Assurance and UX Designer',
    bio: 'Ensures product quality and crafts user-friendly designs.',
    photo: justynImg,
  },
  {
    name: 'Keith Nicolai R. San Miguel',
    role: 'System Analyst',
    bio: 'Ensures system efficiency and aligns technical solutions with business needs.',
    photo: keithImg,
  },
  {
    name: 'Kerr Lawrence T. Atabelo',
    role: 'System Analyst',
    bio: 'Focuses on optimizing system performance and user requirements.',
    photo: kerrImg,
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
              <h1 className="about-title">About Page</h1>
              <p className="about-description">
                
              </p>
            </div>
            <div className="about-pillars">
              <div className="pillar">
                <p className="pillar-title">Overview</p>
                <p className="pillar-copy">This the overview of the team who are responsible for creating the system entitled Play and Palm Inventory Management System</p>
              </div>
              {/* <div className="pillar">
                <p className="pillar-title">About the team</p>
                <p className="pillar-copy">These are th</p>
              </div> */}
              
            </div>
          </section>

    
          <section className="team-section">
            <div className="team-header">
              <div>
                <p className="eyebrow"></p>
                <h2 className="team-title"></h2>
                <p className="team-description">
                  
                </p>
              </div>
            </div>
            <div className="team-grid">
              {TEAM_MEMBERS.map((member) => (
                <div key={member.name} className="team-card">
                  <div className="avatar">
                    <img
                      src={member.photo}
                      alt={`${member.name} portrait`}
                      className="avatar-img"
                    />
                  </div>
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
