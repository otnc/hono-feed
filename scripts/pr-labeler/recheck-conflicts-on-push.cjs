// Run by .github/workflows/pr-labeler.yml via actions/github-script, on push to a base branch.
// A different PR merging into that branch can newly conflict an existing PR without that PR
// itself receiving any event, so this re-checks every open PR targeting the pushed branch.
//
// Kept deliberately light to respect GitHub's API rate limits — both the ~1000 req/hour token
// limit and the secondary/abuse-detection limits on rapid concurrent requests: PRs are checked
// one at a time (not in parallel), and polling for `mergeable` is shorter than the single-PR
// path (this job also reruns on the next push, so a still-unresolved state this time is fine).

const { checkAndLabelConflict } = require('./conflict-label-core.cjs')

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
