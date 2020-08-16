// Your Client ID can be retrieved from your project in the Google
// Developer Console, https://console.developers.google.com
//GAAW Migration Tool
var CLIENT_ID = "380797516150-i9sh9s3mgrk5pqjd2ugp54d0k90pth6c.apps.googleusercontent.com";

var GoogleAuth; // Google Auth object.
var isAuthorized;
var SCOPES = [
    'https://www.googleapis.com/auth/tagmanager.manage.accounts',
    'https://www.googleapis.com/auth/tagmanager.edit.containers',
    'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
    'https://www.googleapis.com/auth/tagmanager.delete.containers'
];

function handleClientLoad() {
    // Load the API's client and auth2 modules.
    // Call the initClient function after the modules load.
    gapi.load('client:auth2', initClient);
}

function initClient() {
    gapi.client.init({
        client_id: CLIENT_ID,
        scope: SCOPES.join(' ')
    }).then(function () {
        GoogleAuth = gapi.auth2.getAuthInstance();
        GoogleAuth.isSignedIn.listen(updateSigninStatus);
        updateSigninStatus(GoogleAuth.isSignedIn.get());
    });
}

function updateSigninStatus(isSignedIn) {
    console.log("updateSigninStatus: " + isSignedIn);
    if (isSignedIn) {
        isAuthorized = true;
        $('#liLogout').show();
        $('#divAuthorization').hide();
        $('#divStepper').css('display', 'inline-block');
        startApp();
    } else {
        isAuthorized = false;
        $('#liLogout').hide();
        $('#divAuthorization').show();
        $('#divStepper').css('display', 'none');
        stepper.to(1);
    }
}

function handleAuthClick(event) {
    if (isAuthorized) 
        updateSigninStatus(isAuthorized);
    else 
        GoogleAuth.signIn();
    
    return false;
}

