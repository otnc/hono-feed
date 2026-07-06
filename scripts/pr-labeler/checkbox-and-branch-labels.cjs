// Run by .github/workflows/pr-labeler.yml via actions/github-script.
// Keeps two label categories in sync with the PR's current state:
//  - bug / enhancement / others, from which PULL_REQUEST_TEMPLATE.md checkbox is checked
//  - to main / to others, from the PR's base branch
// Each run reconciles the PR's labels against the desired set below, adding what's missing and
// removing any of these owned labels that no longer apply. Labels outside this set are untouched.
//
// Triggered by pull_request_target (PR body carried directly on the payload) and by
// issue_comment on a PR (only the PR number is available, so get-pull-request fetches it).

const getPullRequest = require('./get-pull-request.cjs')

// Matches "- [x] Fix bug(s)" (any case/whitespace) against the raw PR body.
function isChecked(body, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`-\\s*\\[[xX]\\]\\s*${escaped}`).test(body)
}

const MANAGED_LABELS = ['bug', 'enhancement', 'others', 'to main', 'to others']

module.exports = async ({ github, context }) => {
  const resolved = await getPullRequest({ github, context })
  if (!resolved) return // issue_comment on a plain issue, not a PR

  const { owner, repo, pr } = resolved
  const issue_number = pr.number
  const body = pr.body || ''

  const desired = new Set()
  if (isChecked(body, 'Fix bug(s)')) desired.add('bug')
  if (isChecked(body, 'New feature(s)')) desired.add('enhancement')
  if (isChecked(body, 'Others')) desired.add('others')
  desired.add(pr.base.ref === 'main' ? 'to main' : 'to others')

  const current = await github.rest.issues.listLabelsOnIssue({ owner, repo, issue_number })
  const currentNames = current.data.map((l) => l.name)

  const toAdd = [...desired].filter((l) => !currentNames.includes(l))
  const toRemove = MANAGED_LABELS.filter((l) => currentNames.includes(l) && !desired.has(l))

  if (toAdd.length) {
    await github.rest.issues.addLabels({ owner, repo, issue_number, labels: toAdd })
  }
  for (const name of toRemove) {
    await github.rest.issues.removeLabel({ owner, repo, issue_number, name }).catch(() => {})
  }
}
