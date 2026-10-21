/**
 * The storage keys of picture slots.
 *
 * These live in their own module so both the image store and the question
 * matcher can use them without importing each other in a circle.
 */

export function questionImageKey(courseKey, topicName, questionIndex) {
  const topic = String(topicName || '').trim().toLowerCase();
  return `${courseKey}::${topic}::${questionIndex}`;
}

/**
 * The key of one picture slot in the raw semester papers. `@semester` keeps
 * these apart from topic keys (a topic could theoretically be named "spring
 * 2017").
 */
export function semesterImageKey(courseKey, semester, questionIndex) {
  const name = String(semester || '').trim().toLowerCase();
  return `${courseKey}::@semester::${name}::${questionIndex}`;
}
