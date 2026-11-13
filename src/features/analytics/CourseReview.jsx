import { useState, useMemo } from 'react';
import { Star, MessageSquare, ThumbsUp, ArrowUpDown, Send, Plus, X, Search } from 'lucide-react';
import CourseAutocomplete from '../../components/CourseAutocomplete';
import './CourseReview.css';
import { sanitizeUserInput, MAX_TEXT_LENGTH, MAX_TITLE_LENGTH } from '../../utils/sanitize';
import { useLiveRefresh } from '../../utils/liveStore';
import { useAuth } from '../../context/AuthContext';
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
    <div className="cr-star-picker">
      <div className="cr-star-picker-head">
        <span>{label}</span>
        <span className="cr-num">{value} / 5</span>
      </div>
      <div className="cr-star-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`cr-star-btn${star <= value ? ' is-on' : ''}`}
            onClick={() => onChange(star)}
            aria-label={`${label} ${star}`}
          >
            <Star size={18} fill={star <= value ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
    </div>
  );
}

const SORT_LABELS = { rating: 'Top rated', difficulty: 'Hardest', workload: 'Heaviest', comments: 'Most discussed' };
const ratingTone = (rating) => (rating >= 4 ? 'is-high' : rating >= 3 ? 'is-mid' : 'is-low');

export default function CourseReview() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState(() => buildCourseReviewList());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [sortMode, setSortMode] = useState('rating');
  const [newComment, setNewComment] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [reviewForm, setReviewForm] = useState(defaultReviewForm);
  const [formError, setFormError] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const trackerCourses = getCoursesFromTracker();

  const refreshReviews = () => {
    const nextReviews = buildCourseReviewList();
    setReviews(nextReviews);
    return nextReviews;
  };

  // Live-sync: reload when another device submits a review/comment/upvote.
  useLiveRefresh(['aust-course-reviews-v2'], refreshReviews);

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
      addCommentToCourse(selectedCourse.id, sanitizeUserInput(newComment, MAX_TEXT_LENGTH), user?.id);
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
        contributorId: user?.id,
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


  const selectCourse = (id) => {
    setSelectedCourseId(id);
    setFormError('');
  };

  return (
    <div className={`cr${selectedCourse ? ' has-selection' : ''}`}>
      <div className="schedule-masthead cr-masthead">
        <div className="schedule-title-block">
          <div className="schedule-icon-tile">
            <Star size={20} strokeWidth={2.2} />
          </div>
          <div>
            <span className="schedule-overline">Shadow</span>
            <div className="schedule-title">Course Reviews</div>
            <span className="schedule-subtitle">
              Live student ratings — averages update when you and others submit reviews.
            </span>
          </div>
        </div>

        <div className="schedule-masthead-center" />

        <div className="schedule-actions cr-actions">
          <div className="search-box cr-search">
            <Search aria-hidden="true" />
            <input
              type="text"
              placeholder="Search reviews..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Search course reviews"
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm cr-sort-btn"
            onClick={() => {
              setSortMode((mode) => {
                if (mode === 'rating') return 'difficulty';
                if (mode === 'difficulty') return 'workload';
                if (mode === 'workload') return 'comments';
                return 'rating';
              });
            }}
            title="Change sort order"
          >
            <ArrowUpDown size={14} />
            <span className="cr-sort-label">{SORT_LABELS[sortMode]}</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm cr-add-btn"
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

      <div className="schedule-dotted-divider shadow-repeat-divider" />

      <div className="cr-body animate-fadeInUp">

      {formMessage && <p className="cr-flash is-ok" role="status">{formMessage}</p>}
      {formError && <p className="cr-flash is-err" role="alert">{formError}</p>}

      {showAddForm && (
        <form onSubmit={submitNewReview} className="cr-form">
          <div className="cr-form-head">
            <h3>Submit a course review</h3>
            <p>Anonymous — only the averages and your comment are shown.</p>
          </div>

          {trackerCourses.length > 0 && (
            <label className="cr-field">
              <span>Pick from CGPA Calculator (optional)</span>
              <select id="review-tracker-course" name="trackerCourse" className="input" defaultValue="" onChange={applyTrackerCourse}>
                <option value="">Select a course...</option>
                {trackerCourses.map((course) => (
                  <option key={course.code} value={course.code}>{course.code} — {course.name}</option>
                ))}
              </select>
            </label>
          )}

          <div className="cr-form-grid">
            <label className="cr-field">
              <span>Course code</span>
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
            <label className="cr-field">
              <span>Course title</span>
              <input
                id="review-course-title"
                name="courseTitle"
                className="input"
                value={reviewForm.name}
                onChange={(event) => setReviewForm((current) => ({ ...current, name: event.target.value }))}
                maxLength={MAX_TITLE_LENGTH}
                placeholder="Database Systems"
                required
              />
            </label>
          </div>

          <div className="cr-star-grid">
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

          <label className="cr-field">
            <span>Comment (optional)</span>
            <textarea
              id="review-comment"
              name="comment"
              className="input"
              rows={3}
              value={reviewForm.commentText}
              onChange={(event) => setReviewForm((current) => ({ ...current, commentText: event.target.value }))}
              maxLength={MAX_TEXT_LENGTH}
              placeholder="Share your experience with this course..."
            />
          </label>

          <button type="submit" className="btn btn-primary cr-submit">
            <Send size={14} /> Publish review
          </button>
        </form>
      )}

      <div className="cr-meta">
        <span><b className="cr-num">{filteredReviews.length}</b> course{filteredReviews.length === 1 ? '' : 's'}</span>
        <span className="cr-meta-dot" aria-hidden="true" />
        <span>Sorted by {SORT_LABELS[sortMode].toLowerCase()}</span>
      </div>

      <div className="cr-layout">
        <div className="cr-list">
          {filteredReviews.length === 0 ? (
            <div className="empty-state cr-empty">
              <MessageSquare size={36} />
              <h3>No reviews yet</h3>
              <p>
                Be the first to rate a course. Use <strong>Add Review</strong> or import a course from your CGPA Calculator.
              </p>
            </div>
          ) : (
            filteredReviews.map((review) => {
              const isSelected = selectedCourseId === review.id;

              return (
                <div
                  key={review.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  className={`cr-card${isSelected ? ' is-selected' : ''}`}
                  onClick={() => selectCourse(review.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      selectCourse(review.id);
                    }
                  }}
                >
                  <div className="cr-card-top">
                    <div className="cr-card-title">
                      <span className="cr-code">{review.course}</span>
                      <h3>{review.name}</h3>
                    </div>
                    <div className={`cr-score ${ratingTone(review.rating)}`}>
                      <Star size={14} fill="currentColor" />
                      <span className="cr-num">{review.rating.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="cr-mini-meters">
                    <div className="cr-mini">
                      <span>Workload</span>
                      <div className="cr-track"><i className="is-workload" style={{ width: `${review.workload * 20}%` }} /></div>
                      <b className="cr-num">{review.workload.toFixed(1)}</b>
                    </div>
                    <div className="cr-mini">
                      <span>Difficulty</span>
                      <div className="cr-track"><i className="is-difficulty" style={{ width: `${review.difficulty * 20}%` }} /></div>
                      <b className="cr-num">{review.difficulty.toFixed(1)}</b>
                    </div>
                  </div>

                  <div className="cr-card-foot">
                    <span><MessageSquare size={12} /> <b className="cr-num">{review.comments.length}</b> comments</span>
                    <span><b className="cr-num">{review.reviews}</b> ratings</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <aside className={`cr-detail${selectedCourse ? '' : ' is-empty'}`} aria-live="polite">
          {selectedCourse ? (
            <div className="cr-detail-inner animate-fadeIn" key={selectedCourse.id}>
              <div className="cr-detail-head">
                <div className="cr-detail-title">
                  <span className="cr-code">{selectedCourse.course}</span>
                  <h3>{selectedCourse.name}</h3>
                  <p>{selectedCourse.reviews} student rating{selectedCourse.reviews === 1 ? '' : 's'}</p>
                </div>
                <div className={`cr-big-score ${ratingTone(selectedCourse.rating)}`}>
                  <span className="cr-num">{selectedCourse.rating.toFixed(1)}</span>
                  <small>/ 5</small>
                </div>
                <button
                  type="button"
                  className="cr-detail-close"
                  onClick={() => setSelectedCourseId(null)}
                  aria-label="Close course details"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="cr-meters">
                <div className="cr-meter">
                  <div className="cr-meter-head">
                    <span>Course difficulty</span>
                    <b className="cr-num">{selectedCourse.difficulty.toFixed(1)} / 5.0</b>
                  </div>
                  <div className="cr-track is-lg"><i className="is-difficulty" style={{ width: `${selectedCourse.difficulty * 20}%` }} /></div>
                </div>
                <div className="cr-meter">
                  <div className="cr-meter-head">
                    <span>Workload intensity</span>
                    <b className="cr-num">{selectedCourse.workload.toFixed(1)} / 5.0</b>
                  </div>
                  <div className="cr-track is-lg"><i className="is-workload" style={{ width: `${selectedCourse.workload * 20}%` }} /></div>
                </div>
              </div>

              <h4 className="cr-section-label">Student feedback</h4>
              <form onSubmit={submitComment} className="cr-comment-form">
                <input
                  id="review-quick-comment"
                  name="quickComment"
                  className="input"
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  maxLength={MAX_TEXT_LENGTH}
                  placeholder="Write a quick review..."
                />
                <button className="btn btn-primary cr-send" type="submit" aria-label="Submit review">
                  <Send size={15} />
                </button>
              </form>
              <div className="cr-comments">
                {selectedCourse.comments.length === 0 ? (
                  <p className="cr-comments-empty">No comments yet. Be the first to share feedback.</p>
                ) : (
                  selectedCourse.comments.map((comment) => {
                    const voted = hasUpvotedComment(comment.id);
                    return (
                      <div key={comment.id} className="cr-comment">
                        <p>&ldquo;{comment.text}&rdquo;</p>
                        <div className="cr-comment-foot">
                          <span>
                            <b className="cr-author">{comment.author || 'Anonymous'}</b>
                            {' · '}Posted {comment.date}
                          </span>
                          <button
                            type="button"
                            className={`cr-upvote${voted ? ' is-voted' : ''}`}
                            onClick={(event) => handleUpvote(comment.id, event)}
                            disabled={voted}
                            aria-label={`Upvote comment (${comment.upvotes})`}
                          >
                            <ThumbsUp size={12} /> <span className="cr-num">{comment.upvotes}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state cr-detail-empty">
              <MessageSquare size={36} />
              <p>Select a course review from the list to see detailed comments and ratings.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
    </div>
  );
}
