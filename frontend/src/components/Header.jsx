// src/components/Header.jsx
export default function Header() {
  return (
    <header className="app-header" style={styles.header}>
      <h1 style={styles.title}>Records</h1>
      <span style={styles.subtitle}>PLAY & PALM</span>
    </header>
  );
}

const styles = {
  header: {
    backgroundColor: '#6a0dad',
    color: 'white',
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '2px solid #5a0b9d',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    width: '100%', // ← Full width of .app-main (which is offset by CSS)
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 'bold',
  },
  subtitle: {
    margin: 0,
    fontSize: '0.875rem',
    opacity: 0.8,
  },
};