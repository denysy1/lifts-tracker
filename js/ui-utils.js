// UI utilities module
export class UIManager {
  constructor() {
    this.converterInitialized = false;
  }

  // Modal functionality
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = "flex";
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = "none";
    }
  }

  // Accordion functionality
  toggleAccordion(headerId, contentId) {
    const header = document.getElementById(headerId);
    const content = document.getElementById(contentId);
    const isExpanded = content.style.display === "block";

    if (isExpanded) {
      content.style.display = "none";
      header.querySelector("span").textContent = "▶ Exercise Options";
    } else {
      content.style.display = "block";
      header.querySelector("span").textContent = "▼ Exercise Options";
    }

    return !isExpanded; // Return new state
  }

  // Input adjustment utilities
  adjustInputValue(inputId, change, min = 0) {
    const input = document.getElementById(inputId);
    let currentValue = parseInt(input.value);
    if (isNaN(currentValue)) {
      currentValue = 0;
    }
    currentValue += change;
    if (currentValue < min) {
      currentValue = min;
    }
    input.value = currentValue;
    return currentValue;
  }

  // File handling utilities
  triggerFileInput(inputId, callback) {
    const fileInput = document.getElementById(inputId);
    if (fileInput) {
      fileInput.click();
      fileInput.onchange = callback;
    }
  }

  // Download file utility
  downloadFile(content, filename, type = 'application/json') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Error and success message handling
  showMessage(message, type = 'info', duration = 3000) {
    // Create message element if it doesn't exist
    let messageContainer = document.getElementById('message-container');
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.id = 'message-container';
      messageContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 300px;
      `;
      document.body.appendChild(messageContainer);
    }

    const messageElement = document.createElement('div');
    messageElement.style.cssText = `
      background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      opacity: 0;
      transition: opacity 0.3s;
    `;
    messageElement.textContent = message;

    messageContainer.appendChild(messageElement);

    // Fade in
    setTimeout(() => messageElement.style.opacity = '1', 10);

    // Auto remove
    if (duration > 0) {
      setTimeout(() => {
        messageElement.style.opacity = '0';
        setTimeout(() => {
          if (messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
          }
        }, 300);
      }, duration);
    }

    return messageElement;
  }

  // Form utilities
  getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};

    const formData = new FormData(form);
    const data = {};
    for (let [key, value] of formData.entries()) {
      data[key] = value;
    }
    return data;
  }

  setFormData(formId, data) {
    const form = document.getElementById(formId);
    if (!form) return;

    Object.entries(data).forEach(([key, value]) => {
      const input = form.querySelector(`[name="${key}"]`);
      if (input) {
        input.value = value;
      }
    });
  }

  // Element visibility utilities
  showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.style.display = 'block';
    }
  }

  hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.style.display = 'none';
    }
  }

  toggleElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      const isVisible = element.style.display !== 'none';
      element.style.display = isVisible ? 'none' : 'block';
      return !isVisible;
    }
    return false;
  }

  // Populate dropdown/select utilities
  populateSelect(selectId, options, selectedValue = null) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '';
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      if (selectedValue && option.value === selectedValue) {
        optionElement.selected = true;
      }
      select.appendChild(optionElement);
    });
  }

  // Text content utilities
  updateText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = text;
    }
  }

  updateHTML(elementId, html) {
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = html;
    }
  }
}
