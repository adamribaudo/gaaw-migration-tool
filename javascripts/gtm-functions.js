//TODO: Fetching more than 1 page of tag results https://developers.google.com/tag-manager/api/v2/reference/accounts/containers/workspaces/tags/list
WORKSPACE_NAME = "GAAW Migration Tool";
var current_accountId;
var current_containerId = null;
var current_workspaceName = null;
var current_workspaceId = null;
var gaawcTag = null;
var existing_gaawc_tagId = null; //Used if the client has already previously created a GAAWC tag in GTM. We'll use this instead of creating a new one
var tagsOfInterest = [];
var numTagsTotal = null;
var configTags = [];
var settingsVars = [];
var settingsToConfigMap = {};

function startApp() {
    // Load Tag Manager API
    new Promise((resolve, reject) => {
        gapi.client.load('tagmanager', 'v2', resolve);
    }).
        //List accounts
        then(() => {
            return requestPromise(gapi.client.tagmanager.accounts.list());
        }).then((response) => {
            var accounts = response.account || [];
            document.getElementById("divAccountsList").innerHTML = Mustache.render(templateAccountsList, { "accounts": accounts });
        }).catch((response) => {
            toastError(response);
        });
}

function handleLogoutClick() {
    $('#divProgress').hide();
    $('#divSuccess').hide();
    GoogleAuth.disconnect();
    location.reload();
}

//Get list of containers within account
function listContainers(accountId) {
    return new Promise((resolve, reject) => {
        var request = gapi.client.tagmanager.accounts.containers.list({
            'parent': "accounts/" + accountId
        });
        return requestPromise(request)
            .then((response) => {
                var containers = response.container || [];
                resolve(containers);
            });
    }
    )
}

function handleLoadAccountClick(accountId) {
    current_accountId = accountId;
    listContainers(accountId).then(containers => {
        stepper.next();
        document.getElementById("divContainersList").innerHTML = Mustache.render(templateContainersList, {
            "containers": containers
        });
    }).catch(response => toastError(response));
}

function handleLoadContainerClick(containerId) {
    current_containerId = containerId;
    getWorkspaces(containerId).then(workspaces => {
        
        if (workspaces.length >= 3) {
            $('#divWorkspaceError').css('display', 'inline-block');
            document.getElementById("divWorkspaceError").innerHTML = "<span style='color:red'>The container you've selected has reached the maximum number of workspaces available. Please log into Google Tag Manage, delete a workspace, and try again.</span><br/><br/>"
        }
        else if (workspaces.findIndex(w => w.name == WORKSPACE_NAME) > -1)
        {
            $('#divWorkspaceError').css('display', 'inline-block');
            document.getElementById("divWorkspaceError").innerHTML = "<span style='color:red'>The container you've selected already contains a workspace named " + WORKSPACE_NAME + ". Please delete this workspace and try again.</span><br/><br/>"
            //TODO For debug purposes
                + "<button id='buttonWorkspaceDelete' onclick='handleWorkSpaceDeleteClick();'>Delete Workspace</button>"
        }
        else {
            createWorkspace();
        }
    })
}

function handleWorkSpaceDeleteClick() {
    //Get Workspace Id
    var request = gapi.client.tagmanager.accounts.containers.workspaces.list({
        'parent': "accounts/" + current_accountId + "/containers/" + current_containerId,
    });

    requestPromise(request).then((response) => {
        return new Promise((resolve, reject) => {
            response.workspace.forEach(el => {
                if (el.name == WORKSPACE_NAME)
                    resolve(el.workspaceId);
            })
        })
    }).then((migrationWorkspaceId) => {
        return requestPromise(gapi.client.request({
            'path': 'https://www.googleapis.com/tagmanager/v2/accounts/' + current_accountId + "/containers/" + current_containerId + "/workspaces/" + migrationWorkspaceId,
            'method':'DELETE'
        }));
    }).then(() => {
        $('#divWorkspaceError').css('display', 'none');
    })
        .catch((error) => {
        console.error(error);
    })
}

function createWorkspace() {   
    var request = gapi.client.tagmanager.accounts.containers.workspaces.create({
        'parent': "accounts/" + current_accountId + "/containers/" + current_containerId,
        'name': WORKSPACE_NAME
    });
    requestPromise(request).then(getConfigAndSettings)
    .catch((response) => {toastError(response);})
}

function getConfigAndSettings(workspace) {
    current_workspaceId = workspace.workspaceId;
    getGAAWConfigTags(workspace).then(getGASettingsVariables).then(() => {
        //Handle a few different scenarios that could arise:
        //1. 1 or more settings & 1 or more configs: templateSettingsMap
        //2. 0 settings & 1 or more configs: templateSettingsNoSettings
        //3. 1 or more settings & 0 configs: templateSettingsNoConfigs
        //4. 0 settings & 0 configs: templateSettingsNoConfigs

        if (settingsVars.length >= 2 && configTags.length >= 1) {
            document.getElementById("divSettingsList").innerHTML = Mustache.render(templateSettingsMap, {
                "settings": settingsVars,
                "configs": configTags
            });
        } else if (settingsVars.length <= 1 && configTags.length >= 1) {
            document.getElementById("divSettingsList").innerHTML = Mustache.render(templateSettingsOneOrNoSettings, {
                "configs": configTags
            });
        } else {
            document.getElementById("divSettingsList").innerHTML = Mustache.render(templateSettingsNoConfigs);
        }

        stepper.next();
    })
}

function getGAAWConfigTags(workspace) {
    return new Promise((resolve, reject) => {
        var request = gapi.client.tagmanager.accounts.containers.workspaces.tags.list({
            'parent': "accounts/" + current_accountId + "/containers/" + current_containerId + "/workspaces/" + workspace.workspaceId
        });

        requestPromise(request).then((response) => {
            response.tag.forEach(el => {
                if (el.type == "gaawc") {
                    var idx = el.parameter.findIndex(p => p.key == "measurementId");
                    var measurementId = "G-0000000000";
                    if (idx > -1)
                        measurementId = el.parameter[idx].value;
                        
                    el.measurementId = measurementId;
                    configTags.push(el)
                }
            })
            resolve(workspace);
        }).catch(response => toastError(response))
    })
}

function getGASettingsVariables(workspace) {
    return new Promise((resolve, reject) => {
        var request = gapi.client.tagmanager.accounts.containers.workspaces.variables.list({
            'parent': "accounts/" + current_accountId + "/containers/" + current_containerId + "/workspaces/" + workspace.workspaceId
        });

        requestPromise(request).then((response) => {
            response.variable.forEach(el => {
                if (el.type == "gas") {
                    //Get tracking ID and push it to root of el object
                    var trackingId = el.parameter[el.parameter.findIndex(p => p.key == "trackingId")].value
                    el.trackingId = trackingId;
                    settingsVars.push(el)
                }
            })
            resolve(workspace);
        }).catch(response => toastError(response))
    })
}

function handleSetingsContinueClick(action) {
    if (action == "map") {
        //Loop through all settings variables and map the variable name to the GAAWC name
        settingsVars.forEach(v => {
            var settingsName = v.name;
            var settingsVarId = v.variableId;
            var configTagName = document.getElementById("selChooseConfig" + settingsVarId).value;

            settingsToConfigMap[settingsName] = configTagName;
        });

        var defaultConfigName = document.getElementById("selDefaultConfigTag").value;
        settingsToConfigMap.default = defaultConfigName;

        getTagsOfInterest();
        stepper.next();

    } else if (action == "oneOrNoSettings") {
        var configTagName = document.getElementById("selConfigTag").value;
        settingsToConfigMap.default = configTagName;

        getTagsOfInterest();
        stepper.next();

    } else if (action == "newConfig") {
        var measurementId = document.getElementById("txtMeasurementId").value;
        createConfigTag(measurementId).then(() => {
            settingsToConfigMap.default = "GAAW Config";
            getTagsOfInterest();
            stepper.next();
        }).catch (response => toastError(response));
    }
}

function createConfigTag(measurementId) {
    var request = gapi.client.tagmanager.accounts.containers.workspaces.tags.create({
        'parent': "accounts/" + current_accountId + "/containers/" + current_containerId + "/workspaces/" + current_workspaceId,
        'name': "GAAW Config",
        'type': "gaawc",
        'parameter': [{'type':"template",'key':"measurementId","value":measurementId}]
        });
        return requestPromise(request)
}

function getTagsOfInterest() {
    var request = gapi.client.tagmanager.accounts.containers.workspaces.tags.list({
        'parent': "accounts/" + current_accountId + "/containers/" + current_containerId + "/workspaces/" + current_workspaceId
    });

    requestPromise(request).then((response) => {
        //Filter to find tags of interest
        numTagsTotal = response.tag.length;

        response.tag.forEach(el => {
            if (el.type == "ua") {
                //Determine available options for this particular tag
                var tagType = null;
                el.parameter.forEach(param => {
                    if (param.key == "trackType")
                        tagType = param.value;
                })
                el.tagType = tagType;
                el.actions = getUATagActions(el);
                //Default to ignoring pageviews
                el.migratedTag = migrateTag(el, tagType == "TRACK_PAGEVIEW" ? "ignore" : tagType);
                el.tagTypeLabel = getTagTypeLabel(tagType);
                tagsOfInterest.push(el);
            }
            else if (el.type == "gaawc") {
                gaawcTag = el;
                existing_gaawc_tagId = el.tagId;
            } else if (el.type == "gaawe") {
                console.log(el);
            }
        })

        stepper.next();
        document.getElementById("divTagsList").innerHTML = Mustache.render(templateTagsList, {
            "tags": tagsOfInterest,
            "gaawcTag": gaawcTag,
            "numTagsTotal": numTagsTotal,
            "numTagsInterest": tagsOfInterest.length
        });

        //TODO this feels redundant, but unclear how else to use renderjson without appendchild
        tagsOfInterest.forEach(el => {
            document.getElementById("tdPreview" + el.tagId).appendChild(
                renderjson(el.migratedTag)
            );
        });
      
    }).catch(response => toastError(response))
} 

function getWorkspaces(containerId) {
    return new Promise((resolve, reject) => {
        var request = gapi.client.tagmanager.accounts.containers.workspaces.list({
            'parent': "accounts/" + current_accountId + "/containers/" + containerId
        });
        return requestPromise(request)
            .then((response) => {
                var workspaces = response.workspace || [];
                resolve(workspaces);
            });
    }
    )
}

/**
 * Wraps an API request into a promise.
 *
 * @param {Object} request the API request.
 * @return {Promise} A promise to execute the api request.
 */
function requestPromise(request) {
    return new Promise((resolve, reject) => {
        request.execute((response) => {
            if (response.code) {
                reject(response);
            }
            resolve(response);
        });
    });
}
