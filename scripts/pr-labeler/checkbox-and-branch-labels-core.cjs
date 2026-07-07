// Shared by checkbox-and-branch-labels.cjs (single PR, event-triggered) and
// recheck-labels-on-push.cjs (bulk, triggered by a push to a base branch). Keeps two label
// categories in sync with the PR's current state:
//  - bug / enhancement / others, from which PULL_REQUEST_TEMPLATE.md checkbox is checked
//  - to main / to others, from the PR's base branch
// Each call reconciles the PR's labels against the desired set below, adding what's missing and
// removing any of these owned labels that no longer apply. Labels outside this set are untouched.

// Matches "- [x] Fix bug(s)" (any case/whitespace) against the raw PR body.
function isChecked(body, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`-\\s*\\[[xX]\\]\\s*${escaped}`).test(body)
}

const MANAGED_LABELS = ['bug', 'enhancement', 'others', 'to main', 'to others']

async function reconcileCheckboxAndBranchLabels({ github, owner, repo, pr }) {
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

module.exports = { reconcileCheckboxAndBranchLabels }
