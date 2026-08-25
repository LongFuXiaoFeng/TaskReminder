#!/usr/bin/env node
/**
 * dsh-taskreminder — npm 安装 CLI
 *
 * Installs the TaskReminder plugin into a DSH profile by copying the plugin
 * source from this npm package into the profile directory and appending the
 * loader patch row to cordis.patch.yml.
 *
 * Usage:
 *   npx dsh-taskreminder [install] [--profile <name>]
 *   npx dsh-taskreminder uninstall [--profile <name>]
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const pkgRoot = path.resolve(__dirname, '..');
const sourcePlugin = path.join(pkgRoot, 'plugin', 'index.js');

function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
}
function profileDir(name) {
  return path.join(dshHome(), 'profiles', name);
}
function pluginDir(profile) {
  return path.join(profileDir(profile), 'taskreminder', 'plugin');
}
function targetPlugin(profile) {
  return path.join(pluginDir(profile), 'index.js');
}
function patchFile(profile) {
  return path.join(profileDir(profile), 'cordis.patch.yml');
}

function log(msg) { console.log('==> ' + msg); }
function ok(msg) { console.log('    ' + msg); }

const NL = '\r\n';
const INSERT_BLOCK = [
  '',
  '# TaskReminder (installed via npm: dsh-taskreminder)',
  '- insert:',
  '    - id: taskreminder',
  '      name: ./taskreminder/plugin/index.js',
  '',
].join(NL);

function install(profile) {
  const profDir = profileDir(profile);
  if (!fs.existsSync(profDir)) {
    throw new Error('profile dir not found: ' + profDir + ' (pass --profile <name>)');
  }

  log('Copying plugin source');
  fs.mkdirSync(pluginDir(profile), { recursive: true });
  fs.copyFileSync(sourcePlugin, targetPlugin(profile));
  ok('copied -> ' + targetPlugin(profile));

  log('Updating composition patch');
  const patch = patchFile(profile);
  let content = fs.existsSync(patch) ? fs.readFileSync(patch, 'utf8') : '';
  if (/id:\s*taskreminder/.test(content)) {
    ok('patch already contains the taskreminder row');
  } else if (/^\[\s*\]\s*$/.test(
    content.replace(/^#[^\r\n]*/gm, '').replace(/^\s*$/gm, '').trim()
  )) {
    // Empty patch `[]` (possibly with comments above): replace [] with our block.
    content = content.replace(/\[\s*\]/, INSERT_BLOCK.trimStart());
    fs.writeFileSync(patch, content, 'utf8');
    ok('patch updated: ' + patch);
  } else {
    // Non-empty patch without taskreminder: append at the end.
    content = content.trimEnd() + NL + INSERT_BLOCK.trimEnd() + NL;
    fs.writeFileSync(patch, content, 'utf8');
    ok('patch updated: ' + patch);
  }

  console.log('\nDone! Restart DSH to load TaskReminder: dsh --profile ' + profile);
}

function uninstall(profile) {
  const dir = path.join(profileDir(profile), 'taskreminder');
  if (fs.existsSync(dir)) {
    // Never follow a junction/symlink target: only remove the link itself.
    const st = fs.lstatSync(dir);
    if (st.isSymbolicLink()) {
      fs.rmSync(dir);
      ok('removed junction/symlink: ' + dir);
    } else {
      fs.rmSync(dir, { recursive: true, force: true });
      ok('removed: ' + dir);
    }
  } else {
    ok('no taskreminder dir at ' + dir);
  }

  const patch = patchFile(profile);
  if (fs.existsSync(patch)) {
    let content = fs.readFileSync(patch, 'utf8');
    const rowRe =
      /(?:^[ \t]*#[^\r\n]*(?:\r?\n|$))+- insert:\r?\n[ \t]+- id: taskreminder\r?\n[ \t]+name: \.\/taskreminder\/plugin\/index\.js\r?\n?/ms;
    if (rowRe.test(content)) {
      content = content.replace(rowRe, '');
      fs.writeFileSync(patch, content.trimEnd() + '\n', 'utf8');
      ok('patch row removed');
    } else {
      ok('patch contains no taskreminder row');
    }
  }
  console.log('\nUninstalled. Restart DSH to unload the plugin.');
}

function main() {
  const args = process.argv.slice(2);
  let cmd = 'install';
  let profile = 'web';
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === 'install' || a === 'uninstall' || a === 'remove') cmd = a === 'remove' ? 'uninstall' : a;
    else if (a === '--profile' || a === '-p') profile = args[++i] || 'web';
    else if (a === '--help' || a === '-h' || a === 'help') {
      console.log('dsh-taskreminder — install/uninstall the TaskReminder DSH plugin');
      console.log('  npx dsh-taskreminder [install] [--profile <name>]');
      console.log('  npx dsh-taskreminder uninstall [--profile <name>]');
      return;
    }
  }
  try {
    if (cmd === 'uninstall') uninstall(profile);
    else install(profile);
  } catch (e) {
    console.error('Error: ' + (e && e.message ? e.message : String(e)));
    process.exit(1);
  }
}

main();
