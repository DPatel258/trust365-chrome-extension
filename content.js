chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const emailField = document.querySelector('input[type="email"], input[name="email"]');
    const passwordField = document.querySelector('input[type="password"], input[name="password"]');

    if (emailField && passwordField) {
        emailField.value = request.email;
        passwordField.value = request.password;
    }
});