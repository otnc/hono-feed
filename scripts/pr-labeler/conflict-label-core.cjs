// Shared by conflict-label.cjs (single PR, event-triggered) and recheck-conflicts-on-push.cjs
// (bulk, triggered by a push to a base branch). Checks one PR's mergeable state and adds/removes
// the "conflict" label to match.

/**
 * @param {object} params
 * @param {number} params.maxAttempts - poll attempts for `mergeable` (GitHub computes it
 *   asynchronously, so it's briefly null right after a relevant event).
 * @param {number} params.pollIntervalMs - delay between attempts.
 */
async function checkAndLabelConflict({
  github,
  owner,
  repo,
  pull_number,
  maxAttempts = 5,
  pollIntervalMs = 3000,
}) {
  let mergeable = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data } = await github.rest.pulls.get({ owner, repo, pull_number })
    mergeable = data.mergeable
    if (mergeable !== null) break
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }
  }

  // Still unresolved after polling: leave the label alone rather than guessing "no conflict" -
  // the next event (or the next push to the base branch) will settle it.
  if (mergeable === null) return

  const hasConflict = mergeable === false
  const current = await github.rest.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number: pull_number,
  })
  const hasLabel = current.data.some((l) => l.name === 'conflict')

  if (hasConflict && !hasLabel) {
    await github.rest.issues.addLabels({
      owner,
      repo,
      issue_number: pull_number,
      labels: ['conflict'],
    })
  } else if (!hasConflict && hasLabel) {
    await github.rest.issues
      .removeLabel({ owner, repo, issue_number: pull_number, name: 'conflict' })
      .catch(() => {})
  }
}

module.exports = { checkAndLabelConflict }
