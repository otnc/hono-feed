// Shared by the other scripts in this directory. `pull_request_target` events carry the PR
// directly on the payload; `issue_comment` events only carry the issue/PR number, so that case
// fetches the PR via the API. Returns null when an issue_comment fired on a plain issue (no PR).
module.exports = async function getPullRequest({ github, context }) {
  const { owner, repo } = context.repo

  if (context.payload.pull_request) {
    return { owner, repo, pr: context.payload.pull_request }
  }

  const issue = context.payload.issue
  if (!issue?.pull_request) return null

  const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: issue.number })
  return { owner, repo, pr }
}
