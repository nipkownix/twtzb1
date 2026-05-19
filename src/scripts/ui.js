/*global navigate*/
import '../lib/spatial-navigation-polyfill.js';
import {
  configAddChangeListener,
  configRead,
  configWrite,
  configGetDesc
} from '../config.js';
import uiCss from '../style/ui.css';
import { APP_VERSION } from '../constants/global.constants.js';
import {
  configOptions,
  DISABLE_ANIMATIONS,
  ENABLE_AD_BLOCK,
  ENABLE_CHAT_OVERLAY,
  CHAT_POSITION,
  CHAT_OVERLAY_WIDTH,
  CHAT_OVERLAY_HEIGHT,
  CHAT_OVERLAY_FONT_SIZE,
  CHAT_OVERLAY_TRANSPARENCY,
  CUSTOM_PROXY_URL,
  ACTION_RESET_CONFIG
} from '../constants/config.constants.js';

// Constants for selectors
// Note: don't use class selectors, as they can change on every twitch deployment
const REJECT_COOKIES_SELECTOR =
  '[role="dialog"][aria-modal="true"] > div:last-child button:first-child';
const MODAL_SVG_SELECTOR = '[role="dialog"][aria-modal="true"] svg';
const contentClassificationSelector =
  'a[href*="tt_medium=content_classification"]';
const bannerAdSelector = '.r-2dbvay';
const latestVideo = 'nav[role="navigation"] + main video';

const HOME_SELECTOR = 'a[href="/"]';
const LOGIN_SELECTOR = 'a[href="/login"]';
const FOLLOWING_SELECTOR = 'a[href="/following"]';
const DIRECTORY_SELECTOR = 'a[href="/directory"]';
const SEARCH_SELECTOR = 'a[href="/search"]';

const LOGGED_IN_NAVIGATION_MAP = {
  49: HOME_SELECTOR, // 1 button
  50: FOLLOWING_SELECTOR, // 2 button
  51: DIRECTORY_SELECTOR, // 3 button
  52: SEARCH_SELECTOR // 4 button
};

const LOGGED_OUT_NAVIGATION_MAP = {
  49: LOGIN_SELECTOR, // 1 button
  50: HOME_SELECTOR, // 2 button
  51: DIRECTORY_SELECTOR, // 3 button
  52: SEARCH_SELECTOR // 4 button
};

const ARROW_KEY_CODE = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };

const colorCodeMap = new Map([
  [403, 'red'],
  [404, 'green'],
  [172, 'green'],
  [405, 'yellow'],
  [170, 'yellow'],
  [406, 'blue'],
  [191, 'blue']
]);

// Global variables
let configOptionKeys = null;

// Function to apply/remove chat overlay styles
function applyChatOverlay(enable) {
  const styleClass = 'with-chat-overlay';
  let existingStyle = document.getElementsByClassName(styleClass);

  if (enable && existingStyle.length === 0) {
    document.body.classList.add(styleClass);
    applyChatPosition();
  } else if (!enable && existingStyle.length > 0) {
    document.body.classList.remove(styleClass);
    document.body.classList.remove('chat-left');
  }
}

// Function to apply chat position (left or right)
function applyChatPosition() {
  const pos = String(configRead(CHAT_POSITION));
  // Reset classes
  document.body.classList.remove('chat-left', 'chat-top', 'chat-bottom');

  const positions = configOptions[CHAT_POSITION].options;
  const [vertical, horizontal] = (() => {
    const posIndex = positions.indexOf(pos);
    const verticals = ['top', 'top', 'bottom', 'bottom'];
    const horizontals = ['left', 'right', 'left', 'right'];
    return [verticals[posIndex] || 'bottom', horizontals[posIndex] || 'right'];
  })();

  if (horizontal === 'left') {
    document.body.classList.add('chat-left');
  }
  if (vertical === 'top') {
    document.body.classList.add('chat-top');
  } else {
    document.body.classList.add('chat-bottom');
  }
}

// Function to apply chat sizing variables
function applyChatSizing() {
  const widthPx = Number(configRead(CHAT_OVERLAY_WIDTH));
  const heightVh = Number(configRead(CHAT_OVERLAY_HEIGHT));
  const fontPx = Number(configRead(CHAT_OVERLAY_FONT_SIZE));
  const transparency = Number(configRead(CHAT_OVERLAY_TRANSPARENCY));

  if (!Number.isNaN(widthPx)) {
    document.body.style.setProperty('--taf-chat-width', String(widthPx));
  }
  if (!Number.isNaN(heightVh)) {
    document.body.style.setProperty('--taf-chat-height', String(heightVh));
  }
  if (!Number.isNaN(fontPx)) {
    document.body.style.setProperty('--taf-chat-font-size', String(fontPx));
  }
  if (!Number.isNaN(transparency)) {
    // Convert 0-100 to 0.0-1.0 for CSS opacity
    const opacity = transparency / 100;
    document.body.style.setProperty('--taf-chat-transparency', String(opacity));
  }
}

/**
 * Returns the name of the color button associated with a code or null if not a color button.
 * @param {number} keyCode KeyboardEvent.keyCode property from event
 * @returns {string | null} Color name or null
 */
function getKeyColor(keyCode) {
  if (colorCodeMap.has(keyCode)) {
    return colorCodeMap.get(keyCode);
  }

  return null;
}

function createConfigCheckbox(key) {
  const elmInput = document.createElement('input');
  const isBoolean = typeof configOptions[key].default === 'boolean';
  const isString = typeof configOptions[key].default === 'string';
  const options = configOptions[key].options;

  if (isBoolean) {
    elmInput.type = 'checkbox';
    elmInput.checked = configRead(key);
  } else if (isString && !options) {
    elmInput.type = 'text';
    elmInput.classList.add('taf-text-input');
    // Ensure value is set even if configRead is not ready yet
    const value = configRead(key);
    elmInput.value = value || configOptions[key].default || '';
  } else {
    elmInput.type = 'hidden';
  }

  /** @type {(evt: Event) => void} */
  const changeHandler = (evt) => {
    if (isBoolean) {
      configWrite(key, evt.target.checked);
    } else if (isString) {
      configWrite(key, evt.target.value);
    }
  };

  elmInput.addEventListener('change', changeHandler);

  let valueSpan = null;
  configAddChangeListener(key, (evt) => {
    if (isBoolean) {
      elmInput.checked = evt.detail.newValue;
    } else if (isString) {
      elmInput.value = String(evt.detail.newValue);
    } else if (valueSpan) {
      valueSpan.textContent = String(evt.detail.newValue);
    }
  });

  // Special handling for CUSTOM_PROXY_URL
  if (key === CUSTOM_PROXY_URL) {
    const container = document.createElement('div');
    container.classList.add('taf-config-item');

    const label = document.createElement('label');
    label.classList.add('taf-config-label');
    label.textContent = configGetDesc(key);

    elmInput.classList.remove('taf-text-input');
    elmInput.classList.add('taf-fullwidth-input');
    elmInput.tabIndex = 0;

    container.appendChild(label);
    container.appendChild(elmInput);
    return container;
  }

  const elmLabel = document.createElement('label');
  elmLabel.appendChild(elmInput);
  // Use non-breaking space (U+00A0)
  elmLabel.appendChild(document.createTextNode('\u00A0' + configGetDesc(key)));

  if (key === ACTION_RESET_CONFIG) {
    // Action button: Reset configuration
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.classList.add('taf-reset-config-btn');
    actionBtn.textContent = '▶ Execute';
    actionBtn.addEventListener('click', () => {
      Object.keys(configOptions).forEach((k) => {
        const def = configOptions[k].default;
        if (def !== null) {
          configWrite(k, def);
        }
      });
      showNotification('Configuration restored to defaults', 4000, 'info');
    });
    actionBtn.tabIndex = 0;

    const btnContainer = document.createElement('span');
    btnContainer.classList.add('taf-number-arrows');
    btnContainer.appendChild(document.createTextNode(' '));
    btnContainer.appendChild(actionBtn);
    elmLabel.appendChild(btnContainer);
  } else if ((!isBoolean && !isString) || options) {
    // Arrow buttons and value display for numeric settings
    const container = document.createElement('span');
    container.classList.add('taf-number-arrows');

    const decBtn = document.createElement('button');
    decBtn.type = 'button';
    decBtn.textContent = '◀';
    const incBtn = document.createElement('button');
    incBtn.type = 'button';
    incBtn.textContent = '▶';
    valueSpan = document.createElement('span');
    valueSpan.classList.add('taf-number-value');
    valueSpan.textContent = String(configRead(key));

    const getDelta = () => {
      switch (key) {
        case CHAT_OVERLAY_WIDTH:
          return 10; // fine adjustments via arrows
        case CHAT_OVERLAY_HEIGHT:
          return 5;
        case CHAT_OVERLAY_FONT_SIZE:
          return 1;
        case CHAT_OVERLAY_TRANSPARENCY:
          return 5;
        default:
          return 1;
      }
    };

    const cyclePosition = (dir) => {
      const current = String(configRead(CHAT_POSITION));
      const idx = options.indexOf(current);
      const nextIdx =
        (idx + (dir === 'next' ? 1 : -1) + options.length) % options.length;
      const next = options[nextIdx];
      configWrite(CHAT_POSITION, next);
      valueSpan.textContent = next;
    };

    if (key === CHAT_POSITION) {
      valueSpan.textContent = String(configRead(CHAT_POSITION));
      decBtn.addEventListener('click', () => cyclePosition('prev'));
      incBtn.addEventListener('click', () => cyclePosition('next'));
    } else {
      decBtn.addEventListener('click', () => {
        const current = Number(configRead(key));
        const next = Math.max(0, current - getDelta());
        configWrite(key, next);
      });
      incBtn.addEventListener('click', () => {
        const current = Number(configRead(key));
        let next = current + getDelta();
        // Cap transparency at 100%
        if (key === CHAT_OVERLAY_TRANSPARENCY) {
          next = Math.min(100, next);
        }
        configWrite(key, next);
      });
    }

    // Make focusable for remote navigation
    decBtn.tabIndex = 0;
    incBtn.tabIndex = 0;

    container.appendChild(document.createTextNode(' '));
    container.appendChild(decBtn);
    container.appendChild(document.createTextNode(' '));
    container.appendChild(valueSpan);
    container.appendChild(document.createTextNode(' '));
    container.appendChild(incBtn);
    elmLabel.appendChild(container);
  }

  return elmLabel;
}

function createOptionsPanel() {
  const elmContainer = document.createElement('div');
  elmContainer.classList.add('taf-ui-container');
  elmContainer.style.display = 'none';
  elmContainer.setAttribute('tabindex', '0');
  elmContainer.setAttribute('role', 'dialog');
  elmContainer.setAttribute('aria-modal', 'true');
  elmContainer.setAttribute('aria-label', 'Twitch AdFree Settings');

  // Array para almacenar todos los elementos enfocables
  const focusableElements = [];

  elmContainer.addEventListener(
    'keydown',
    (evt) => {
      if (getKeyColor(evt.keyCode) === 'green') return;

      const focusables = Array.from(
        elmContainer.querySelectorAll(
          '.taf-ui-container input[type="checkbox"], .taf-ui-container input[type="text"], .taf-ui-container button'
        )
      );

      if (evt.keyCode in ARROW_KEY_CODE) {
        const direction = ARROW_KEY_CODE[evt.keyCode];
        const currentIndex = focusables.indexOf(document.activeElement);
        let nextIndex = currentIndex;

        // If no element is focused, start from the first focusable element
        if (['down', 'right'].includes(direction)) {
          nextIndex = (currentIndex + 1) % focusables.length;
        } else if (['up', 'left'].includes(direction)) {
          nextIndex =
            (currentIndex - 1 + focusables.length) % focusables.length;
        }

        focusables[nextIndex].focus();
        evt.preventDefault();
        evt.stopPropagation();
      } else if (evt.keyCode === 13) {
        // Enter
        document.activeElement.click();
        evt.preventDefault();
        evt.stopPropagation();
      }
    },
    true
  );

  // Header section
  const header = document.createElement('header');
  const headerContent = document.createElement('div');
  headerContent.style.display = 'flex';
  headerContent.style.justifyContent = 'space-between';
  headerContent.style.alignItems = 'center';

  const elmHeading = document.createElement('h1');
  elmHeading.textContent = 'Twitch AdFree Settings';
  headerContent.appendChild(elmHeading);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.width = '40px';
  closeBtn.style.height = '40px';
  closeBtn.style.padding = '0';
  closeBtn.style.fontSize = '24px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.color = '#9147ff';
  closeBtn.style.display = 'flex';
  closeBtn.style.alignItems = 'center';
  closeBtn.style.justifyContent = 'center';
  closeBtn.title = 'Close settings panel';
  closeBtn.addEventListener('click', () => showOptionsPanel(false));
  headerContent.appendChild(closeBtn);

  header.appendChild(headerContent);

  const elmSubtitle = document.createElement('p');
  elmSubtitle.textContent =
    'Press [GREEN] to close; use buttons to adjust settings';
  elmSubtitle.classList.add('taf-subtitle');
  elmContainer.appendChild(header);
  elmContainer.appendChild(elmSubtitle);

  // Options list
  const optionsList = document.createElement('div');
  optionsList.classList.add('taf-options-list');

  if (!configOptionKeys) {
    configOptionKeys = Object.keys(configOptions);
  }

  configOptionKeys.forEach((option) => {
    const checkboxContainer = createConfigCheckbox(option);
    const checkboxInput = checkboxContainer.querySelector('input');
    checkboxInput.tabIndex = 0; // Make checkbox focusable
    optionsList.appendChild(checkboxContainer);
    focusableElements.push(checkboxInput);
  });

  elmContainer.appendChild(optionsList);

  // Footer
  const footer = document.createElement('footer');
  footer.classList.add('taf-footer');
  const versionInfo = document.createElement('p');
  versionInfo.innerHTML = `v${APP_VERSION} &mdash; <a href="https://github.com/adamff-dev" target="_blank" rel="noopener noreferrer">
  <img src="https://github.githubassets.com/favicons/favicon.png" alt="github.com" class="github-icon">adamff-dev
</a>`;
  footer.appendChild(versionInfo);
  elmContainer.appendChild(footer);

  return elmContainer;
}

const optionsPanel = createOptionsPanel();
document.body.appendChild(optionsPanel);

let optionsPanelVisible = false;

/**
 * Show or hide the options panel.
 * @param {boolean} [visible=true] Whether to show the options panel.
 */
function showOptionsPanel(visible) {
  visible ??= true;

  if (visible && !optionsPanelVisible) {
    optionsPanel.style.display = 'block';
    optionsPanel.focus();
    optionsPanelVisible = true;
  } else if (!visible && optionsPanelVisible) {
    optionsPanel.style.display = 'none';
    optionsPanel.blur();
    optionsPanelVisible = false;
  }
}

window.taf_showOptionsPanel = showOptionsPanel;

function handleNumberButtonsClick(keyCode) {
  const buttonSelector = document.querySelector(LOGIN_SELECTOR)
    ? LOGGED_OUT_NAVIGATION_MAP[keyCode]
    : LOGGED_IN_NAVIGATION_MAP[keyCode];
  const buttonElement = document.querySelector(buttonSelector);
  if (buttonElement) {
    buttonElement.click();
  }
}

const eventHandler = (evt) => {
  // Navigate through all focusable buttons using a dynamic button list.
  // This avoids relying on DOM structure and is resilient to Twitch changes.
  if (!optionsPanelVisible && evt.keyCode in ARROW_KEY_CODE) {
    const tafBtn = document.querySelector('.taf-settings-btn');
    if (tafBtn) {
      const dir = ARROW_KEY_CODE[evt.keyCode];
      const active = document.activeElement;

      // Find all focusable buttons in the player container
      const playerContainer = tafBtn.closest('[class*="player"], [class*="Player"], .video-player, .player-controls')
        || tafBtn.closest('[role="application"]')
        || document.body;
      const allButtons = Array.from(playerContainer.querySelectorAll('button, a[href]')).filter(btn => {
        // Filter out hidden/disabled buttons and non-interactive elements
        const style = window.getComputedStyle(btn);
        return style.display !== 'none' && style.visibility !== 'hidden' && btn.offsetParent !== null;
      });

      // Build navigation list and find TAF position
      const navigationList = [...allButtons];
      const tafIndex = navigationList.indexOf(tafBtn);

      // If TAF not in list, insert it after first button (original options button)
      if (tafIndex === -1) {
        navigationList.splice(1, 0, tafBtn);
      }

      // Find current position in navigation list
      const currentIndex = navigationList.indexOf(active);
      if (currentIndex !== -1) {
        let nextIndex = currentIndex;

        // Calculate next position based on direction (circular navigation)
        if (dir === 'left' || dir === 'up') {
          nextIndex = (currentIndex - 1 + navigationList.length) % navigationList.length;
        } else if (dir === 'right' || dir === 'down') {
          nextIndex = (currentIndex + 1) % navigationList.length;
        }

        const nextBtn = navigationList[nextIndex];
        if (nextBtn) {
          nextBtn.focus();
          evt.preventDefault();
          evt.stopPropagation();
          return false;
        }
      }
    }
  }

  if (Object.keys(LOGGED_IN_NAVIGATION_MAP).includes(String(evt.keyCode))) {
    handleNumberButtonsClick(evt.keyCode);
    evt.preventDefault();
    evt.stopPropagation();
    return false;
  }

  if (getKeyColor(evt.keyCode) === 'green') {
    evt.preventDefault();
    evt.stopPropagation();

    if (evt.type === 'keydown') {
      // Toggle visibility.
      showOptionsPanel(!optionsPanelVisible);
    }
    return false;
  }
  return true;
};

export function showNotification(text, time = 7000, type = 'success') {
  if (!document.querySelector('.taf-notification-container')) {
    const c = document.createElement('div');
    c.classList.add('taf-notification-container');
    document.body.appendChild(c);
  }

  const elm = document.createElement('div');
  const elmInner = document.createElement('div');
  elmInner.innerHTML = text;
  elmInner.classList.add('message');
  elmInner.classList.add('message-hidden');
  elmInner.classList.add(`message-${type}`);
  elm.appendChild(elmInner);
  document.querySelector('.taf-notification-container').appendChild(elm);

  setTimeout(() => {
    elmInner.classList.remove('message-hidden');
  }, 100);
  setTimeout(() => {
    elmInner.classList.add('message-hidden');
    setTimeout(() => {
      elm.remove();
    }, 1000);
  }, time);
}

/**
 * Initializes the removal of CSS transition animations based on a configuration setting.
 * Appends a <style> element to the document head to disable transitions globally when enabled.
 * Listens for changes to the DISABLE_ANIMATIONS config and updates the style accordingly.
 */
function initRemoveAnimations() {
  const uiStyle = document.createElement('style');
  uiStyle.textContent = uiCss;
  document.head.appendChild(uiStyle);

  const style = document.createElement('style');
  document.head.appendChild(style);

  const setHidden = (hide) => {
    style.textContent = hide ? '* { transition: none !important; }' : '';
  };

  setHidden(configRead(DISABLE_ANIMATIONS));

  configAddChangeListener(DISABLE_ANIMATIONS, (evt) => {
    setHidden(evt.detail.newValue);
  });
}

function injectSettingsButton() {
  if (document.querySelector('.taf-settings-btn')) return;
  const qualityBtn = document.querySelector('[aria-label="Quality Settings"]');
  if (!qualityBtn || !qualityBtn.parentElement || !qualityBtn.parentElement.parentElement) return;

  // Deep-clone the entire wrapper+button so we inherit all of Twitch's CSS classes
  // (the spatial nav polyfill and Tizen's native nav both see it as a first-class button)
  const wrapper = qualityBtn.parentElement.cloneNode(true);
  const btn = wrapper.querySelector('button') || wrapper;
  btn.setAttribute('aria-label', 'Twitch AdFree Settings');
  btn.removeAttribute('aria-expanded');
  btn.classList.add('taf-settings-btn');

  const svg = btn.querySelector('svg');
  if (svg) {
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.innerHTML = '<path d="M10 2L4 5v4c0 3.87 2.54 7.3 6 8.93C13.46 16.3 16 12.87 16 9V5L10 2zm0 2.27L14 6.2V9c0 2.77-1.64 5.28-4 6.53C7.64 14.28 6 11.77 6 9V6.2l4-1.93z"/>';
  }

  btn.addEventListener('click', () => showOptionsPanel(true));
  qualityBtn.parentElement.parentElement.insertBefore(wrapper, qualityBtn.parentElement);
}

function handleAdsAndConsentModals() {
  const enableAdBlock = configRead(ENABLE_AD_BLOCK);

  const observer = new MutationObserver(() => {
    injectSettingsButton();
    const adElement = document.querySelector(bannerAdSelector);
    const videoElement = document.querySelector('video');

    if (videoElement && enableAdBlock) {
      const isAdVisible = !!adElement;
      const shouldMute =
        isAdVisible &&
        (!videoElement.muted || videoElement.style.display !== 'none');
      const shouldUnmute =
        !isAdVisible &&
        (videoElement.muted || videoElement.style.display === 'none');

      if (shouldMute) {
        videoElement.muted = true;
        videoElement.style.display = 'none';
        showNotification('Ads muted and hidden');
      } else if (shouldUnmute) {
        videoElement.muted = false;
        videoElement.style.display = 'block';
      }
    }

    // Auto-reject cookies if the modal is present
    const rejectCookiesButton = document.querySelector(REJECT_COOKIES_SELECTOR);
    const modalSvg = document.querySelector(MODAL_SVG_SELECTOR);
    if (rejectCookiesButton && modalSvg) {
      rejectCookiesButton.click();
      showNotification('Cookie consent rejected automatically');
    }

    // Auto-accept adult content if the modal is present
    const acceptAdultContentButton = document.querySelector(
      contentClassificationSelector
    );
    if (
      acceptAdultContentButton &&
      acceptAdultContentButton.previousElementSibling
    ) {
      acceptAdultContentButton.previousElementSibling.click();
      showNotification('Mature content warning dismissed automatically');
    }

    // Remove the channel home latest video preview to improve performance and prevent potential crashes
    // (This is a known Twitch bug)
    const posterElement = document.querySelector(latestVideo);
    if (posterElement) {
      posterElement.remove();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function initKeyListeners() {
  document.addEventListener('keydown', eventHandler, true);
  // document.addEventListener('keypress', eventHandler, true);
  // document.addEventListener('keyup', eventHandler, true);
}

function initChatOverlay() {
  // Apply initial state
  applyChatOverlay(configRead(ENABLE_CHAT_OVERLAY));
  if (configRead(ENABLE_CHAT_OVERLAY)) {
    applyChatSizing();
  }

  // Listen for changes
  configAddChangeListener(ENABLE_CHAT_OVERLAY, (evt) => {
    applyChatOverlay(evt.detail.newValue);
  });

  // Listen for chat position changes
  configAddChangeListener(CHAT_POSITION, () => {
    if (configRead(ENABLE_CHAT_OVERLAY)) {
      applyChatPosition();
    }
  });

  // Listen for chat sizing changes
  const sizingKeys = [
    CHAT_OVERLAY_WIDTH,
    CHAT_OVERLAY_HEIGHT,
    CHAT_OVERLAY_FONT_SIZE,
    CHAT_OVERLAY_TRANSPARENCY
  ];
  sizingKeys.forEach((k) => {
    configAddChangeListener(k, () => {
      if (configRead(ENABLE_CHAT_OVERLAY)) {
        applyChatSizing();
      }
    });
  });
}

function init() {
  handleAdsAndConsentModals();
  initRemoveAnimations();
  initKeyListeners();
  initChatOverlay();
  injectSettingsButton();

  showNotification('Press [GREEN] button to open configuration', 5000, 'info');
}

init();
