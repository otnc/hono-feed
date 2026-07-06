// Run by .github/workflows/pr-labeler.yml via actions/github-script.
// Adds/removes the "conflict" label to match the PR's current mergeable state.
//
// Triggered by pull_request_target and by issue_comment on a PR; get-pull-request resolves the
// PR number from whichever event shape fired (and returns null for a comment on a plain issue).

const getPullRequest = require('./get-pull-request.cjs')

module.exports = async ({ github, context }) => {
  const resolved = await getPullRequest({ github, context })
  if (!resolved) return // issue_comment on a plain issue, not a PR

  const { owner, repo, pr } = resolved
  const pull_number = pr.number

  // GitHub computes `mergeable` asynchronously; it can briefly be null right after the
  // triggering event, so poll a few times before treating "no conflict" as final.
  let mergeable = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await github.rest.pulls.get({ owner, repo, pull_number })
    mergeable = data.mergeable
    if (mergeable !== null) break
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

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
