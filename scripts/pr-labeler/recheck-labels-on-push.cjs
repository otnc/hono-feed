// Run by .github/workflows/pr-labeler.yml via actions/github-script, on push to a base branch.
// A push to a base branch can change what's true for every open PR targeting it: a different PR
// merging in can newly conflict this one, and the checkbox/branch labels never get (re)applied to
// a PR that opened before this workflow existed, or whose labels drifted since. So this reconciles
// every managed label for every open PR targeting the pushed branch, not just conflict.
//
// Kept deliberately light to respect GitHub's API rate limits — both the ~1000 req/hour token
// limit and the secondary/abuse-detection limits on rapid concurrent requests: PRs are checked
// one at a time (not in parallel), and polling for `mergeable` is shorter than the single-PR
// path (this job also reruns on the next push, so a still-unresolved state this time is fine).

const { checkAndLabelConflict } = require('./conflict-label-core.cjs')
const { reconcileCheckboxAndBranchLabels } = require('./checkbox-and-branch-labels-core.cjs')

module.exports = async ({ github, context }) => {
  const { owner, repo } = context.repo
  const branch = context.ref.replace('refs/heads/', '')

  const openPRs = await github.paginate(github.rest.pulls.list, {
    owner,
    repo,
    state: 'open',
    base: branch,
    per_page: 100,
  })

  for (const pr of openPRs) {
    await reconcileCheckboxAndBranchLabels({ github, owner, repo, pr })
    await checkAndLabelConflict({
      github,
      owner,
      repo,
      pull_number: pr.number,
      maxAttempts: 2,
      pollIntervalMs: 2000,
    })
  }
}
