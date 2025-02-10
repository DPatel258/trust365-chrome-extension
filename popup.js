document.addEventListener('DOMContentLoaded', function () {
    const loginSection = document.getElementById('login-section');
    const passwordSection = document.getElementById('password-section');
    const loginButton = document.getElementById('login-button');
    const fetchButton = document.getElementById('fetch-passwords');
    const emailInput = document.getElementById('email');
    // const passwordInput = document.getElementById('password');
    const passwordList = document.getElementById('password-list');
    // Get the logout button
    const logoutButton = document.getElementById('logoutButton');

    // Add click event listener for logout button
    logoutButton.addEventListener('click', function () {
        // Remove the authToken from chrome.storage.sync to log the user out
        chrome.storage.sync.remove(['authToken'], function () {
            // After removal, show the login section and hide the password section
            loginSection.style.display = 'block';
            passwordSection.style.display = 'none';
        });
    });
    // Check authentication and toggle visibility
    chrome.storage.sync.get(['authToken'], function (result) {
        if (result.authToken) {
            // Authenticated: Show password section
            loginSection.style.display = 'none';
            passwordSection.style.display = 'block';
            loadPasswordDataFromStorage();
        } else {
            // Not authenticated: Show login section
            loginSection.style.display = 'block';
            passwordSection.style.display = 'none';
        }
    });

    // Event listener for login button
    loginButton.addEventListener('click', function () {
        const email = emailInput.value;
        // const password = passwordInput.value;
        if (email) {
            loginUser(email);
        } else {
            alert('Please enter both email and password');
        }
    });

    // Event listener for fetch button
    fetchButton.addEventListener('click', function () {
        fetchPasswordRecords();
    });

    function loginUser(email) {
        fetch('https://app.datasurance.co.uk/api/extension_login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        })
            .then(response => response.json())
            .then(data => {
                if (data.status) {
                    // Start polling for login status using the login_request_id
                    alert('Login sent to your mobile device. Please check your phone to continue.');
                    pollForStatus(data.login_request_id);
                } else {
                    alert(data.message || 'Login failed');
                }
            })
            .catch(error => {
                console.error('Login Error:', error);
                alert('An error occurred. Please try again later.');
            });
    }
    // Function to poll for login status
    function pollForStatus(loginRequestId) {
        const intervalId = setInterval(() => {
            fetch(`https://app.datasurance.co.uk/api/getloginstatus/${loginRequestId}`, {
                method: 'POST',
            })
                .then(response => response.json())
                .then(data => {
                    console.log('Polling Result:', data);

                    if (data.status === 'success') {
                        clearInterval(intervalId); // Stop polling
                        // Stop the timeout to avoid showing a timeout alert unnecessarily
                        clearTimeout(timeoutId);

                        if (data.message === 'Login successful') {
                            // Process the token directly if included in the response
                            if (data.token) {
                                chrome.storage.sync.set({ authToken: data.token }, function () {
                                    alert('Login successful');
                                    loginSection.style.display = 'none';
                                    passwordSection.style.display = 'block';
                                    loadPasswordDataFromStorage();
                                });
                            } else {
                                alert('Something went wrong. Please try again later.');
                            }
                        } else {
                            alert('Login failed. Please try again.');
                        }
                    }
                })
                .catch(error => {
                    console.error('Polling Error:', error);
                });
        }, 5000); // Poll every 5 seconds

        // Stop polling after 2 minutes
        const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            alert('Login timed out. Please try again.');
        }, 120000);
    }

    function loadPasswordDataFromStorage() {
        chrome.storage.sync.get(['passwordRecords'], function (result) {
            if (result.passwordRecords) {
                displayPasswordRecords(result.passwordRecords);
            } else {
                passwordList.innerHTML = '<p>No password records found. Click "Fetch Password Records" to load data.</p>';
            }
        });
    }

    function fetchPasswordRecords() {
        chrome.storage.sync.get(['authToken'], function (result) {
            const token = result.authToken;

            if (!token) {
                alert('You must log in first.');
                return;
            }

            fetch('https://app.datasurance.co.uk/api/getpassword', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            })
                .then(response => response.json())
                .then(async (data) => {
                    if (data.status) {
                        const decryptedData = await decryptData(data.data, token); // Wait for decryption to resolve
                        chrome.storage.sync.set({ passwordRecords: decryptedData }, function () {
                            displayPasswordRecords(decryptedData);
                        });
                    } else {
                        passwordList.innerHTML = `<p>${data.message}</p>`;
                    }
                })

        });
    }

    function displayPasswordRecords(records) {
        passwordList.innerHTML = '';
        records.forEach(record => {
            const passwordItem = document.createElement('div');
            passwordItem.classList.add('password-item');

            const domain = document.createElement('p');
            domain.textContent = `Account: ${record.name}`;
            passwordItem.appendChild(domain);

            const email = document.createElement('p');
            email.textContent = `Email: ${record.email}`;
            passwordItem.appendChild(email);

            // Add click event to each record
            passwordItem.addEventListener('click', function () {
                autofillWebPage(record);
            });

            passwordList.appendChild(passwordItem);
        });
    }

    // Function to autofill email and password on the web page
    function autofillWebPage(record) {
        // Decode the Base64 encoded string
        var decodedData = atob(record.password);
        // Parse the JSON string back into an object
        var parsedData = JSON.parse(decodedData);
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: fillFormFields,
                args: [record.email, parsedData]
            });
        });
    }

    // Function that fills the form fields on the web page
    function fillFormFields(email, password) {
        const emailField = document.querySelector('input[name="email"]');
        const passwordField = document.querySelector('input[type="password"]');

        if (emailField && passwordField) {
            emailField.value = email;
            passwordField.value = password;
        } else {
            alert('Could not find email or password fields on this page.');
        }
    }

    async function decryptData(apiResponse, token) {
        const response = await fetch('https://app.datasurance.co.uk/api/decryptdata', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ apiResponse }),
        });

        const data = await response.json();
        // Return the data received in the response
        return data;
    }
});