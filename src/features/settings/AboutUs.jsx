import { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Mail, GitBranch, Globe, ExternalLink, Heart, Quote,
  Code, Zap, Coffee, Moon, Users, Star, Cpu, BookOpen,
  MessageCircle, Camera, Briefcase, Image, Send
} from 'lucide-react';
import './AboutUs.css';

// ─── Developer Info ───
const DEV = {
  name: 'Mubasshir Mehedi',
  initials: 'MM',
  title: 'The Brain Behind AUSTWise',
  tagline: 'Solo developer · CSE @ AUST · Problem Solver',
  email: 'erumthakbe@gmail.com',
  github: 'erumthakbe',
  facebook: 'erumthakbe',
  instagram: 'erumthakbe',
  linkedin: 'erumthakbe',
  batch: 'Quanta 52',
  department: 'CSE',
  university: 'Ahsanullah University of Science & Technology',
  quote: 'Code is poetry. Every line I write is a step toward making education simpler, smarter, and more accessible for every AUST student.',
  funFacts: [
    'Built this entire platform solo — from concept to deployment',
    'Spent countless late nights debugging so you don\'t have to',
    'Believes the best code is the code that makes life easier',
    'Coffee ☕ and curiosity — the two engines behind AUSTWise',
  ],
};

// ─── Animated Counter ───
function AnimatedCounter({ value, label, icon: Icon, suffix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true;
        const duration = 2000;
        const steps = 60;
        const increment = value / steps;
        let current = 0;
        const timer = setInterval(() => {
          current += increment;
          if (current >= value) {
            setCount(value);
            clearInterval(timer);
          } else {
            setCount(Math.floor(current));
          }
        }, duration / steps);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div className="about-stat-card" ref={ref}>
      <div className="about-stat-icon">
        <Icon size={22} />
      </div>
      <div className="about-stat-value">
        {count}{suffix}
      </div>
      <div className="about-stat-label">{label}</div>
    </div>
  );
}

// ─── Tech Stack ───
const techStack = [
  { name: 'React 18', icon: Code, color: '#61dafb' },
  { name: 'Vite', icon: Zap, color: '#ffc018' },
  { name: 'JavaScript', icon: Cpu, color: '#f7df1e' },
  { name: 'CSS3', icon: Sparkles, color: '#1572b6' },
  { name: 'Node.js', icon: Code, color: '#339933' },
  { name: 'Chart.js', icon: Star, color: '#ff6384' },
  { name: 'PDF.js', icon: BookOpen, color: '#ed1c24' },
  { name: 'Mermaid', icon: GitBranch, color: '#ff3670' },
];

export default function AboutUs() {
  const [avatarSrc, setAvatarSrc] = useState(() => localStorage.getItem('austwise_dev_avatar'));
  const [typedText, setTypedText] = useState('');
  const fullText = 'Hello, I\'m Mubasshir 👋';
  const [mounted, setMounted] = useState(false);

  // Mount animation
  useEffect(() => {
    setMounted(true);
  }, []);

  // Typewriter effect
  useEffect(() => {
    if (!mounted) return;
    let i = 0;
    const timer = setInterval(() => {
      if (i < fullText.length) {
        setTypedText(fullText.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 80);
    return () => clearInterval(timer);
  }, [mounted]);

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl === 'string') {
        localStorage.setItem('austwise_dev_avatar', dataUrl);
        setAvatarSrc(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const stats = [
    { value: 50, label: 'Features Built', icon: Code, suffix: '+' },
    { value: 12, label: 'Months of Development', icon: Moon, suffix: '+' },
    { value: 100, label: 'Cups of Coffee', icon: Coffee, suffix: '+' },
    { value: 1, label: 'Solo Developer', icon: Heart, suffix: '' },
  ];

  const socialLinks = [
    {
      name: 'Email',
      url: `mailto:${DEV.email}`,
      icon: Mail,
      color: '#ea4335',
      label: DEV.email,
    },
    {
      name: 'GitHub',
      url: `https://github.com/${DEV.github}`,
      icon: GitBranch,
      color: '#fff',
      label: `@${DEV.github}`,
    },
    {
      name: 'LinkedIn',
      url: `https://linkedin.com/in/${DEV.linkedin}`,
      icon: Briefcase,
      color: '#0a66c2',
      label: `@${DEV.linkedin}`,
    },
    {
      name: 'Facebook',
      url: `https://facebook.com/${DEV.facebook}`,
      icon: Globe,
      color: '#1877f2',
      label: `@${DEV.facebook}`,
    },
    {
      name: 'Instagram',
      url: `https://instagram.com/${DEV.instagram}`,
      icon: Image,
      color: '#e4405f',
      label: `@${DEV.instagram}`,
    },
    {
      name: 'Messenger',
      url: `https://m.me/${DEV.facebook}`,
      icon: Send,
      color: '#006aff',
      label: 'Chat with me',
    },
  ];

  return (
    <div className={`about-us-page ${mounted ? 'about-mounted' : ''}`}>
      {/* ─── Floating Orbs Background ─── */}
      <div className="about-orb-bg" aria-hidden="true">
        <div className="about-orb about-orb-1" />
        <div className="about-orb about-orb-2" />
        <div className="about-orb about-orb-3" />
      </div>

      {/* ─── Hero Section ─── */}
      <section className="about-hero">
        <div className="about-hero-bg-grid" aria-hidden="true" />
        <div className="about-hero-content">
          {/* Avatar with animated glow ring */}
          <div className="about-avatar-wrapper">
            <div className="about-avatar-ring" />
            <div
              className="about-avatar"
              onClick={() => document.getElementById('about-avatar-input')?.click()}
              title="Click to upload your photo"
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt={DEV.name} />
              ) : (
                <span className="about-avatar-initials">{DEV.initials}</span>
              )}
            </div>
            <button
              className="about-avatar-upload-btn"
              onClick={() => document.getElementById('about-avatar-input')?.click()}
              title="Upload photo"
            >
              <Camera size={14} />
            </button>
            <input
              id="about-avatar-input"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarUpload}
            />
          </div>

          {/* Typed greeting */}
          {/* Style options: about-greeting | about-greeting--solid | about-greeting--gold */}
          <h1 className="about-greeting about-greeting--gold">
            {typedText}<span className="about-cursor">|</span>
          </h1>

          <div className="about-title-tag">
            <Sparkles size={16} />
            <span>{DEV.title}</span>
            <Sparkles size={16} />
          </div>

          <p className="about-tagline">{DEV.tagline}</p>

          {/* Badges */}
          <div className="about-badges">
            <span className="about-badge">
              <BookOpen size={12} /> {DEV.department}
            </span>
            <span className="about-badge">
              <Users size={12} /> {DEV.batch}
            </span>
            <span className="about-badge">
              <Code size={12} /> Solo Dev
            </span>
          </div>
        </div>
      </section>

      {/* ─── Stats Section ─── */}
      <section className="about-stats-section">
        <div className="about-stats-grid">
          {stats.map((stat) => (
            <AnimatedCounter
              key={stat.label}
              value={stat.value}
              label={stat.label}
              icon={stat.icon}
              suffix={stat.suffix}
            />
          ))}
        </div>
      </section>

      {/* ─── The Story ─── */}
      <section className="about-story">
        <div className="about-story-glow" aria-hidden="true" />
        <div className="about-story-content">
          <div className="about-section-label">
            <Heart size={14} />
            <span>The Story</span>
            <Heart size={14} />
          </div>
          <h2 className="about-story-title">
            What is <span className="about-gradient-text">AUSTWise</span>?
          </h2>
          <div className="about-story-text">
            <p>
              AUSTWise was born from a simple idea: <strong>why should students have to juggle a dozen different tools</strong>
              just to manage their academic life? From CGPA tracking and class schedules to resource sharing and
              community boards — everything a student needs, under one roof.
            </p>
            <p>
              Built entirely by one person — fueled by curiosity, countless late nights, and an unwavering belief that
              <strong> technology should serve education</strong>, not complicate it. Every pixel, every line of code,
              every feature was crafted with the AUST student in mind.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Quote ─── */}
      <section className="about-quote-section">
        <div className="about-quote-card">
          <Quote size={24} className="about-quote-icon" />
          <blockquote>
            {DEV.quote}
          </blockquote>
          <div className="about-quote-attribution">
            — {DEV.name}
          </div>
        </div>
      </section>

      {/* ─── Fun Facts ─── */}
      <section className="about-facts-section">
        <div className="about-section-label">
          <Sparkles size={14} />
          <span>Fun Facts</span>
          <Sparkles size={14} />
        </div>
        <div className="about-facts-grid">
          {DEV.funFacts.map((fact, i) => (
            <div key={i} className="about-fact-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="about-fact-number">0{i + 1}</span>
              <p>{fact}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Tech Stack ─── */}
      <section className="about-tech-section">
        <div className="about-section-label">
          <Cpu size={14} />
          <span>Built With</span>
          <Cpu size={14} />
        </div>
        <div className="about-tech-grid">
          {techStack.map((tech) => (
            <div key={tech.name} className="about-tech-badge">
              <div className="about-tech-icon" style={{ color: tech.color }}>
                <tech.icon size={18} />
              </div>
              <span>{tech.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Social Links ─── */}
      <section className="about-social-section">
        <div className="about-section-label">
          <Heart size={14} />
          <span>Connect With Me</span>
          <Heart size={14} />
        </div>
        <div className="about-social-grid">
          {socialLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="about-social-card"
              style={{ '--social-color': link.color }}
            >
              <div className="about-social-card-bg" />
              <div className="about-social-card-content">
                <link.icon size={20} />
                <div>
                  <strong>{link.name}</strong>
                  <span>{link.label}</span>
                </div>
                <ExternalLink size={14} className="about-social-external" />
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="about-cta-section">
        <div className="about-cta-card">
          <div className="about-cta-particles" aria-hidden="true">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="about-cta-particle" style={{ animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
          <h3>Have an idea? Want to collaborate?</h3>
          <p>I'm always open to conversations, feedback, and new ideas.</p>
          <a href={`mailto:${DEV.email}`} className="about-cta-btn">
            <Mail size={18} />
            <span>Say Hello</span>
          </a>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <div className="about-footer">
        <Heart size={14} className="about-footer-heart" />
        <p>Built with love by {DEV.name} · {DEV.batch} · Not affiliated with AUST</p>
      </div>
    </div>
  );
}
