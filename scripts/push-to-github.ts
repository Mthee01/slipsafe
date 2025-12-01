import { getUncachableGitHubClient, getGitHubUser } from '../server/lib/github';
import * as fs from 'fs';
import * as path from 'path';

const REPO_NAME = 'slipsafe';

const FILES_TO_PUSH = [
  'client/index.html',
  'client/public/manifest.json',
  'client/public/sw.js',
  'client/src/App.tsx',
  'client/src/components/alerts-widget.tsx',
  'client/src/components/app-sidebar.tsx',
  'client/src/components/install-prompt.tsx',
  'client/src/components/offline-indicator.tsx',
  'client/src/components/theme-provider.tsx',
  'client/src/components/ui/accordion.tsx',
  'client/src/components/ui/alert-dialog.tsx',
  'client/src/components/ui/alert.tsx',
  'client/src/components/ui/aspect-ratio.tsx',
  'client/src/components/ui/avatar.tsx',
  'client/src/components/ui/badge.tsx',
  'client/src/components/ui/breadcrumb.tsx',
  'client/src/components/ui/button.tsx',
  'client/src/components/ui/calendar.tsx',
  'client/src/components/ui/card.tsx',
  'client/src/components/ui/carousel.tsx',
  'client/src/components/ui/chart.tsx',
  'client/src/components/ui/checkbox.tsx',
  'client/src/components/ui/collapsible.tsx',
  'client/src/components/ui/command.tsx',
  'client/src/components/ui/context-menu.tsx',
  'client/src/components/ui/dialog.tsx',
  'client/src/components/ui/drawer.tsx',
  'client/src/components/ui/dropdown-menu.tsx',
  'client/src/components/ui/form.tsx',
  'client/src/components/ui/hover-card.tsx',
  'client/src/components/ui/input-otp.tsx',
  'client/src/components/ui/input.tsx',
  'client/src/components/ui/label.tsx',
  'client/src/components/ui/menubar.tsx',
  'client/src/components/ui/navigation-menu.tsx',
  'client/src/components/ui/pagination.tsx',
  'client/src/components/ui/popover.tsx',
  'client/src/components/ui/progress.tsx',
  'client/src/components/ui/radio-group.tsx',
  'client/src/components/ui/resizable.tsx',
  'client/src/components/ui/scroll-area.tsx',
  'client/src/components/ui/select.tsx',
  'client/src/components/ui/separator.tsx',
  'client/src/components/ui/sheet.tsx',
  'client/src/components/ui/sidebar.tsx',
  'client/src/components/ui/skeleton.tsx',
  'client/src/components/ui/slider.tsx',
  'client/src/components/ui/switch.tsx',
  'client/src/components/ui/table.tsx',
  'client/src/components/ui/tabs.tsx',
  'client/src/components/ui/textarea.tsx',
  'client/src/components/ui/toaster.tsx',
  'client/src/components/ui/toast.tsx',
  'client/src/components/ui/toggle-group.tsx',
  'client/src/components/ui/toggle.tsx',
  'client/src/components/ui/tooltip.tsx',
  'client/src/hooks/use-auth.ts',
  'client/src/hooks/use-mobile.tsx',
  'client/src/hooks/use-online-status.ts',
  'client/src/hooks/use-toast.ts',
  'client/src/index.css',
  'client/src/lib/indexedDB.ts',
  'client/src/lib/queryClient.ts',
  'client/src/lib/utils.ts',
  'client/src/main.tsx',
  'client/src/pages/claims.tsx',
  'client/src/pages/forgot-password.tsx',
  'client/src/pages/forgot-username.tsx',
  'client/src/pages/home.tsx',
  'client/src/pages/login.tsx',
  'client/src/pages/not-found.tsx',
  'client/src/pages/profile.tsx',
  'client/src/pages/receipts.tsx',
  'client/src/pages/register.tsx',
  'client/src/pages/reset-password.tsx',
  'client/src/pages/settings.tsx',
  'components.json',
  'design_guidelines.md',
  'drizzle.config.ts',
  '.gitignore',
  'package.json',
  'postcss.config.js',
  'README.md',
  'replit.md',
  'server/auth.ts',
  'server/index.ts',
  'server/lib/email.ts',
  'server/lib/github.ts',
  'server/lib/ocr.ts',
  'server/lib/pdf.ts',
  'server/routes.ts',
  'server/storage.ts',
  'server/vite.ts',
  'shared/schema.ts',
  'tailwind.config.ts',
  'tsconfig.json',
  'vite.config.ts',
];

const BINARY_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.pdf'];

function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.includes(ext);
}

async function main() {
  try {
    const octokit = await getUncachableGitHubClient();
    const user = await getGitHubUser();
    const owner = user.login;
    
    console.log(`Pushing to ${owner}/${REPO_NAME}...`);
    
    // First, check if repo is empty by trying to get the default branch
    let parentSha: string | undefined;
    let isEmptyRepo = false;
    
    try {
      const { data: ref } = await octokit.git.getRef({
        owner,
        repo: REPO_NAME,
        ref: 'heads/main',
      });
      parentSha = ref.object.sha;
      console.log('Repository has existing commits, parent:', parentSha);
    } catch (e: any) {
      if (e.status === 404 || e.status === 409) {
        console.log('Repository is empty, initializing with README...');
        isEmptyRepo = true;
        
        // Create initial commit using Contents API (this is the only way to init an empty repo)
        const readmePath = path.join(process.cwd(), 'README.md');
        const readmeContent = fs.readFileSync(readmePath, 'utf-8');
        
        const { data: fileResult } = await octokit.repos.createOrUpdateFileContents({
          owner,
          repo: REPO_NAME,
          path: 'README.md',
          message: 'Initial commit',
          content: Buffer.from(readmeContent).toString('base64'),
          branch: 'main',
        });
        
        // Get the commit SHA directly from the file creation response
        parentSha = fileResult.commit.sha!;
        console.log('Initialized repository, parent:', parentSha);
      } else {
        throw e;
      }
    }
    
    // Build tree items with content directly (for empty repos)
    const treeItems: Array<{
      path: string;
      mode: '100644';
      type: 'blob';
      content?: string;
      sha?: string;
    }> = [];
    
    for (const filePath of FILES_TO_PUSH) {
      // Skip README if we just created it via Contents API
      if (isEmptyRepo && filePath === 'README.md') {
        console.log(`Skipping ${filePath} (already created)`);
        continue;
      }
      
      const fullPath = path.join(process.cwd(), filePath);
      
      if (!fs.existsSync(fullPath)) {
        console.log(`Skipping ${filePath} (not found)`);
        continue;
      }
      
      console.log(`Processing ${filePath}...`);
      
      if (isBinaryFile(filePath)) {
        // For binary files, we need to create a blob first
        const content = fs.readFileSync(fullPath).toString('base64');
        
        // Try to create blob - for empty repos this might fail, so we'll skip binary files initially
        if (parentSha) {
          const blob = await octokit.git.createBlob({
            owner,
            repo: REPO_NAME,
            content,
            encoding: 'base64',
          });
          treeItems.push({
            path: filePath,
            mode: '100644',
            type: 'blob',
            sha: blob.data.sha,
          });
        } else {
          console.log(`  Skipping binary file (empty repo): ${filePath}`);
        }
      } else {
        // For text files, include content directly
        const content = fs.readFileSync(fullPath, 'utf-8');
        treeItems.push({
          path: filePath,
          mode: '100644',
          type: 'blob',
          content,
        });
      }
    }
    
    console.log(`\nPrepared ${treeItems.length} files for commit`);
    
    // Create tree
    const treeParams: any = {
      owner,
      repo: REPO_NAME,
      tree: treeItems,
    };
    
    if (parentSha) {
      // Get parent tree to base new tree on
      const { data: parentCommit } = await octokit.git.getCommit({
        owner,
        repo: REPO_NAME,
        commit_sha: parentSha,
      });
      treeParams.base_tree = parentCommit.tree.sha;
    }
    
    const tree = await octokit.git.createTree(treeParams);
    console.log('Created tree:', tree.data.sha);
    
    // Create commit
    const commitParams: any = {
      owner,
      repo: REPO_NAME,
      message: 'Initial commit - SlipSafe receipt management system\n\nReceipt management with OCR, QR codes, deadline tracking, and PWA support.',
      tree: tree.data.sha,
    };
    
    if (parentSha) {
      commitParams.parents = [parentSha];
    } else {
      commitParams.parents = [];
    }
    
    const commit = await octokit.git.createCommit(commitParams);
    console.log('Created commit:', commit.data.sha);
    
    // Create or update main branch reference
    if (parentSha) {
      await octokit.git.updateRef({
        owner,
        repo: REPO_NAME,
        ref: 'heads/main',
        sha: commit.data.sha,
      });
    } else {
      await octokit.git.createRef({
        owner,
        repo: REPO_NAME,
        ref: 'refs/heads/main',
        sha: commit.data.sha,
      });
    }
    
    console.log('\n✅ Successfully pushed to GitHub!');
    console.log(`Repository: https://github.com/${owner}/${REPO_NAME}`);
    
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

main();
