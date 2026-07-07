// Run by .github/workflows/pr-labeler.yml via actions/github-script.
//
// Triggered by pull_request_target (PR body carried directly on the payload) and by
// issue_comment on a PR (only the PR number is available, so get-pull-request fetches it).

const getPullRequest = require('./get-pull-request.cjs')
const { reconcileCheckboxAndBranchLabels } = require('./checkbox-and-branch-labels-core.cjs')

module.exports = async ({ github, context }) => {
  const resolved = await getPullRequest({ github, context })
  if (!resolved) return // issue_comment on a plain issue, not a PR

  const { owner, repo, pr } = resolved
  await reconcileCheckboxAndBranchLabels({ github, owner, repo, pr })
}
