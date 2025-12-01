import { Octokit } from '@octokit/rest';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

export async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

export async function getGitHubUser() {
  const octokit = await getUncachableGitHubClient();
  const { data } = await octokit.users.getAuthenticated();
  return data;
}

export async function listUserRepos() {
  const octokit = await getUncachableGitHubClient();
  const { data } = await octokit.repos.listForAuthenticatedUser({
    sort: 'updated',
    per_page: 100
  });
  return data;
}

export async function createRepo(name: string, description: string, isPrivate: boolean = true) {
  const octokit = await getUncachableGitHubClient();
  const { data } = await octokit.repos.createForAuthenticatedUser({
    name,
    description,
    private: isPrivate,
    auto_init: false
  });
  return data;
}

export async function getRepo(owner: string, repo: string) {
  const octokit = await getUncachableGitHubClient();
  try {
    const { data } = await octokit.repos.get({ owner, repo });
    return data;
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function commitFilesToGitHub(
  owner: string,
  repo: string,
  branch: string,
  message: string,
  files: { path: string; content: string }[]
) {
  const octokit = await getUncachableGitHubClient();
  
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`
  });
  const latestCommitSha = refData.object.sha;

  const { data: commitData } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: latestCommitSha
  });
  const baseTreeSha = commitData.tree.sha;

  const blobs = await Promise.all(
    files.map(async (file) => {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: Buffer.from(file.content).toString('base64'),
        encoding: 'base64'
      });
      return {
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha
      };
    })
  );

  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: blobs
  });

  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.sha,
    parents: [latestCommitSha]
  });

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha
  });

  return newCommit;
}
