import { DoorOpen, Search, MapPin } from 'lucide-react';
import './EmptyClassroomPage.css';
import '../../components/PageHero.css';

export default function EmptyClassroomPage() {
  return (
    <div className="ecf-page animate-fadeIn">
      <header className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-title-row">
            <div className="page-hero-icon">
              <DoorOpen size={24} />
            </div>
            <div>
              <h1 className="page-hero-title">
                <span className="page-hero-title-highlight">Free Rooms</span>
              </h1>
              <p className="page-hero-subtitle">
                Find available classrooms for self-study, group work, or extra practice.
              </p>
            </div>
          </div>
        </div>
      </header>
      <div className="ecf-coming-soon">
        <div className="ecf-cs-card">
          <Search size={32} strokeWidth={1.5} />
          <h2>Classroom Finder — Coming Soon</h2>
          <p>See real-time availability of all classrooms across campus. Filter by building, floor, capacity, and time slot to find the perfect spot.</p>
          <div className="ecf-feature-pills">
            <span><DoorOpen size={14} /> Real-Time Availability</span>
            <span><MapPin size={14} /> Floor Maps</span>
            <span><Search size={14} /> Capacity Filter</span>
          </div>
        </div>
      </div>
    </div>
  );
}
