/**
 * UI Helpers - Visual formatting for CLI
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgBlue: '\x1b[44m',
};

class UI {
  showLogo() {
    const logo = `
${colors.cyan}╔══════════════════════════════════════════════════════════════╗${colors.reset}
${colors.cyan}║${colors.reset}${colors.bright}           🎛️  OVERDRIVE AI AGENT                          ${colors.reset}${colors.cyan}║${colors.reset}
${colors.cyan}║${colors.reset}   Unified MCP for Claude, VS Code, Kiro IDE              ${colors.cyan}║${colors.reset}
${colors.cyan}╚══════════════════════════════════════════════════════════════╝${colors.reset}
    `;
    console.log(logo);
  }

  section(title) {
    console.log(`\n${colors.cyan}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}  ${title}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  }

  success(text) {
    console.log(`${colors.green}✅ ${text}${colors.reset}`);
  }

  error(text) {
    console.log(`${colors.red}❌ ${text}${colors.reset}`);
  }

  warning(text) {
    console.log(`${colors.yellow}⚠️  ${text}${colors.reset}`);
  }

  info(text) {
    console.log(`${colors.blue}ℹ️  ${text}${colors.reset}`);
  }

  status(label, value, status = 'info') {
    const icon = status === 'success' ? '✅' : status === 'error' ? '❌' : 'ℹ️ ';
    const color = status === 'success' ? colors.green : status === 'error' ? colors.red : colors.blue;
    console.log(`  ${icon} ${colors.bright}${label}${colors.reset}: ${color}${value}${colors.reset}`);
  }

  table(headers, rows) {
    const colWidths = headers.map((h, i) => {
      const maxRow = Math.max(...rows.map(r => String(r[i] || '').length));
      return Math.max(h.length, maxRow) + 2;
    });

    // Header
    const headerLine = headers
      .map((h, i) => h.padEnd(colWidths[i]))
      .join('│');
    console.log(headerLine);
    console.log('─'.repeat(headerLine.length));

    // Rows
    rows.forEach(row => {
      const line = row
        .map((cell, i) => String(cell || '').padEnd(colWidths[i]))
        .join('│');
      console.log(line);
    });
  }

  box(title, content) {
    const lines = content.split('\n');
    const maxWidth = Math.max(title.length, ...lines.map(l => l.length)) + 4;

    console.log(`\n${colors.cyan}┌${'─'.repeat(maxWidth - 2)}┐${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} ${colors.bright}${title}${colors.reset}${''.padEnd(maxWidth - title.length - 3)} ${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}├${'─'.repeat(maxWidth - 2)}┤${colors.reset}`);
    lines.forEach(line => {
      console.log(`${colors.cyan}│${colors.reset} ${line.padEnd(maxWidth - 3)} ${colors.cyan}│${colors.reset}`);
    });
    console.log(`${colors.cyan}└${'─'.repeat(maxWidth - 2)}┘${colors.reset}\n`);
  }

  progressBar(current, total, label = '') {
    const width = 30;
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    const percent = Math.round((current / total) * 100);

    const bar = `${colors.green}${'█'.repeat(filled)}${colors.dim}${'░'.repeat(empty)}${colors.reset}`;
    console.log(`  ${bar} ${percent}% ${label}`);
  }

  list(items, ordered = false) {
    items.forEach((item, i) => {
      const prefix = ordered ? `${i + 1}.` : '•';
      console.log(`  ${prefix} ${item}`);
    });
  }

  divider() {
    console.log('');
  }

  code(text, lang = 'bash') {
    console.log(`\n${colors.dim}${text}${colors.reset}\n`);
  }
}

module.exports = UI;
