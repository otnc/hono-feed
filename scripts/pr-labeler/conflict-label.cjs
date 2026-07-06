// Run by .github/workflows/pr-labeler.yml via actions/github-script.
// Adds/removes the "conflict" label to match the PR's current mergeable state.
//
// Triggered by pull_request_target and by issue_comment on a PR; get-pull-request resolves the
// PR number from whichever event shape fired (and returns null for a comment on a plain issue).

const getPullRequest = require('./get-pull-request.cjs')
const { checkAndLabelConflict } = require('./conflict-label-core.cjs')

module.exports = async ({ github, context }) => {
  const resolved = await getPullRequest({ github, context })
  if (!resolved) return // issue_comment on a plain issue, not a PR

  const { owner, repo, pr } = resolved
  await checkAndLabelConflict({ github, owner, repo, pull_number: pr.number })
}
