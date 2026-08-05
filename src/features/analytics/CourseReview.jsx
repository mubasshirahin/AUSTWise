import React, { useMemo, useState } from 'react';
import { Star, MessageSquare, ThumbsUp, ArrowUpDown, Send, Plus, X } from 'lucide-react';
import CourseAutocomplete from '../../components/CourseAutocomplete';
import { sanitizeUserInput, MAX_TEXT_LENGTH, MAX_TITLE_LENGTH } from '../../utils/sanitize';
import {
  addCommentToCourse,
  addCourseReview,
  buildCourseReviewList,
  getCoursesFromTracker,
  hasUpvotedComment,
  upvoteComment,
} from '../../utils/courseReviewStorage';

const defaultReviewForm = {
  course: '',
  name: '',
  rating: 4,
  difficulty: 3,
  workload: 3,
  commentText: '',
};

function StarPicker({ value, onChange, label }) {
  return (
    <div>
      <div className="flex justify-between" style={{ fontSize: '11px', marginBottom: '4px' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 'bold' }}>{value} / 5</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="btn-ghost"
            onClick={() => onChange(star)}
            style={{ padding: '2px', color: star <= value ? 'var(--accent-amber)' : 'var(--text-tertiary)' }}
            aria-label={`${label} ${star}`}
          >
            <Star size={16} fill={star <= value ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CourseReview() {
  const [reviews, setReviews] = useState(() => buildCourseReviewList());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [sortMode, setSortMode] = useState('rating');
  const [newComment, setNewComment] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [reviewForm, setReviewForm] = useState(defaultReviewForm);
  const [formError, setFormError] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const trackerCourses = useMemo(() => getCoursesFromTracker(), [reviews.length, showAddForm]);

  const refreshReviews = () => {
    const nextReviews = buildCourseReviewList();
    setReviews(nextReviews);
    return nextReviews;
  };

  const filteredReviews = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = reviews.filter((review) =>
      review.course.toLowerCase().includes(term)
      || review.name.toLowerCase().includes(term),
    );

    return [...filtered].sort((left, right) => {
      if (sortMode === 'difficulty') return right.difficulty - left.difficulty;
      if (sortMode === 'workload') return right.workload - left.workload;
      if (sortMode === 'comments') return right.comments.length - left.comments.length;
      return right.rating - left.rating;
    });
  }, [reviews, searchTerm, sortMode]);

  const selectedCourse = useMemo(
    () => reviews.find((review) => review.id === selectedCourseId) || null,
    [reviews, selectedCourseId],
  );

  const handleUpvote = (commentId, event) => {
    event.stopPropagation();
    try {
      const result = upvoteComment(commentId);
      setReviews(result.reviews);
      if (result.alreadyVoted) {
        setFormError('You already upvoted this comment.');
      } else {
        setFormError('');
      }
    } catch (error) {
      setFormError(error.message || 'Could not upvote comment.');
    }
  };

  const submitComment = (event) => {
    event.preventDefault();
    if (!selectedCourse || !newComment.trim()) return;

    try {
      addCommentToCourse(selectedCourse.id, sanitizeUserInput(newComment, MAX_TEXT_LENGTH));
      const nextReviews = refreshReviews();
      setNewComment('');
      setFormError('');
      setSelectedCourseId(selectedCourse.id);
      if (!nextReviews.find((review) => review.id === selectedCourse.id)) {
        setSelectedCourseId(nextReviews[0]?.id ?? null);
      }
    } catch (error) {
      setFormError(error.message || 'Could not post comment.');
    }
  };

  const submitNewReview = (event) => {
    event.preventDefault();
    setFormError('');
    setFormMessage('');

    try {
      const courseId = addCourseReview({
        ...reviewForm,
        course: sanitizeUserInput(reviewForm.course, MAX_TITLE_LENGTH),
        name: sanitizeUserInput(reviewForm.name, MAX_TITLE_LENGTH),
        commentText: sanitizeUserInput(reviewForm.commentText, MAX_TEXT_LENGTH),
      });
      const nextReviews = refreshReviews();
      setReviewForm(defaultReviewForm);
      setShowAddForm(false);
      setSelectedCourseId(courseId);
      setFormMessage('Review saved. Averages update as more students contribute.');
      if (!nextReviews.find((review) => review.id === courseId)) {
        setSelectedCourseId(nextReviews[0]?.id ?? null);
      }
    } catch (error) {
      setFormError(error.message || 'Could not save review.');
    }
  };

  const applyTrackerCourse = (event) => {
    const code = event.target.value;
    if (!code) return;
    const match = trackerCourses.find((course) => course.code === code);
    if (!match) return;
    setReviewForm((current) => ({ ...current, course: match.code, name: match.name }));
  };

  return (
    <div className="course-reviews-container animate-fadeInUp">
      <div className="schedule-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <MessageSquare size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Analytics</span>
            <div className="schedule-title">Course Reviews</div>
            <span className="schedule-subtitle">
              Live student ratings — averages update when you and others submit reviews.
            </span>
          </div>
        </div>

        <div className="schedule-masthead-center" />

        <div className="schedule-actions">
          <div className="search-box" style={{ width: '220px' }}>
            <input
              type="text"
              placeholder="Search reviews..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              style={{ padding: '6px 12px 6px 36px' }}
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSortMode((mode) => {
                if (mode === 'rating') return 'difficulty';
                if (mode === 'difficulty') return 'workload';
                if (mode === 'workload') return 'comments';
                return 'rating';
              });
            }}
          >
            <ArrowUpDown size={14} /> {sortMode}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowAddForm((open) => !open);
              setFormError('');
              setFormMessage('');
            }}
          >
            {showAddForm ? <X size={14} /> : <Plus size={14} />}
            {showAddForm ? 'Close' : 'Add Review'}
          </button>
        </div>
      </div>

      <div className="schedule-dotted-divider" />

      {formMessage && (
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-emerald)', marginBottom: '12px' }}>{formMessage}</p>
      )}
      {formError && (
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-rose)', marginBottom: '12px' }}>{formError}</p>
      )}

      {showAddForm && (
        <form
          onSubmit={submitNewReview}
          className="glass-card"
          style={{ padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', margin: 0 }}>Submit a course review</h3>

          {trackerCourses.length > 0 && (
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Pick from CGPA Bol (optional)</span>
              <select className="input" defaultValue="" onChange={applyTrackerCourse}>
                <option value="">Select a course...</option>
                {trackerCourses.map((course) => (
                  <option key={course.code} value={course.code}>{course.code} — {course.name}</option>
                ))}
              </select>
            </label>
          )}

          <div className="grid-2" style={{ gap: '10px' }}>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              Course code
              <CourseAutocomplete
                value={reviewForm.course}
                onCourseSelect={(course) => setReviewForm((current) => ({ 
                  ...current, 
                  course: course.code, 
                  name: course.name 
                }))}
                placeholder="CSE 3101"
                type="code"
              />
            </label>
            <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              Course title
              <input
                className="input"
                value={reviewForm.name}
                onChange={(event) => setReviewForm((current) => ({ ...current, name: event.target.value }))}
                maxLength={MAX_TITLE_LENGTH}
                placeholder="Database Systems"
                required
              />
            </label>
          </div>

          <div className="grid-3" style={{ gap: '12px' }}>
            <StarPicker
              label="Overall rating"
              value={reviewForm.rating}
              onChange={(rating) => setReviewForm((current) => ({ ...current, rating }))}
            />
            <StarPicker
              label="Difficulty"
              value={reviewForm.difficulty}
              onChange={(difficulty) => setReviewForm((current) => ({ ...current, difficulty }))}
            />
            <StarPicker
              label="Workload"
              value={reviewForm.workload}
              onChange={(workload) => setReviewForm((current) => ({ ...current, workload }))}
            />
          </div>

          <label style={{ fontSize: 'var(--fs-xs)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            Comment (optional)
            <textarea
              className="input"
              rows={3}
              value={reviewForm.commentText}
              onChange={(event) => setReviewForm((current) => ({ ...current, commentText: event.target.value }))}
              maxLength={MAX_TEXT_LENGTH}
              placeholder="Share your experience with this course..."
            />
          </label>

          <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
            <Send size={14} /> Publish review
          </button>
        </form>
      )}

      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredReviews.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 16px' }}>
              <MessageSquare size={36} />
              <h3 style={{ fontSize: 'var(--fs-md)', marginTop: '8px' }}>No reviews yet</h3>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                Be the first to rate a course. Use <strong>Add Review</strong> or import a course from your CGPA Bol.
              </p>
            </div>
          ) : (
            filteredReviews.map((review) => {
              const isSelected = selectedCourseId === review.id;

              return (
                <div
                  key={review.id}
                  onClick={() => {
                    setSelectedCourseId(review.id);
                    setFormError('');
                  }}
                  style={{
                    background: isSelected ? 'var(--accent-amber-glow)' : 'var(--bg-card)',
                    border: isSelected ? '1px solid color-mix(in srgb, var(--accent-amber) 45%, transparent)' : '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all var(--transition-base)',
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 'bold' }}>{review.course}</span>
                      <h3 style={{ fontSize: '15px', fontWeight: 'var(--fw-bold)' }}>{review.name}</h3>
                    </div>
                    <div className="flex items-center gap-1" style={{ color: 'var(--accent-amber)' }}>
                      <Star size={16} fill="currentColor" />
                      <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-sm)' }}>{review.rating.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-4" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <div className="flex gap-4">
                      <span>Workload: <b>{review.workload.toFixed(1)}/5</b></span>
                      <span>Difficulty: <b>{review.difficulty.toFixed(1)}/5</b></span>
                    </div>
                    <span className="flex items-center gap-1">
                      <MessageSquare size={12} /> {review.comments.length} · {review.reviews} ratings
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div
          className="glass-card-static"
          style={{
            minHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: selectedCourse ? 'flex-start' : 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
          }}
        >
          {selectedCourse ? (
            <div className="animate-fadeIn">
              <div style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 'bold' }}>{selectedCourse.course}</span>
                <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>{selectedCourse.name}</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {selectedCourse.reviews} student rating{selectedCourse.reviews === 1 ? '' : 's'}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <div>
                  <div className="flex justify-between" style={{ fontSize: '11px', marginBottom: '2px' }}>
                    <span>Course Difficulty</span>
                    <span style={{ fontWeight: 'bold' }}>{selectedCourse.difficulty.toFixed(1)} / 5.0</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${selectedCourse.difficulty * 20}%`, background: 'var(--accent-rose)' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between" style={{ fontSize: '11px', marginBottom: '2px' }}>
                    <span>Workload Intensity</span>
                    <span style={{ fontWeight: 'bold' }}>{selectedCourse.workload.toFixed(1)} / 5.0</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${selectedCourse.workload * 20}%`, background: 'var(--accent-amber)' }} />
                  </div>
                </div>
              </div>

              <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '10px' }}>Student Feedbacks</h4>
              <form onSubmit={submitComment} className="flex gap-2 mb-4">
                <input
                  className="input"
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  maxLength={MAX_TEXT_LENGTH}
                  placeholder="Write a quick review..."
                  style={{ fontSize: 'var(--fs-xs)' }}
                />
                <button className="btn btn-primary btn-sm" type="submit" aria-label="Submit review">
                  <Send size={13} />
                </button>
              </form>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {selectedCourse.comments.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No comments yet. Be the first to share feedback.</p>
                ) : (
                  selectedCourse.comments.map((comment) => {
                    const voted = hasUpvotedComment(comment.id);
                    return (
                      <div
                        key={comment.id}
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 12px',
                        }}
                      >
                        <p style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.4' }}>&ldquo;{comment.text}&rdquo;</p>
                        <div className="flex justify-between items-center mt-2" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          <span>
                            <b style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: 'var(--accent-purple, #a855f7)' }}>{comment.author || 'Anonymous'}</b>
                            {' · '}Posted {comment.date}
                          </span>
                          <button
                            type="button"
                            className="flex items-center gap-1 btn-ghost"
                            onClick={(event) => handleUpvote(comment.id, event)}
                            disabled={voted}
                            style={{
                              padding: '2px 4px',
                              borderRadius: '4px',
                              opacity: voted ? 0.55 : 1,
                            }}
                          >
                            <ThumbsUp size={10} /> {comment.upvotes}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <MessageSquare size={36} />
              <p style={{ fontSize: 'var(--fs-sm)' }}>Select a course review from the list to see detailed comments and ratings.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
