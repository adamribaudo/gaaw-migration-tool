//Given a UA tag, provides properties supplied to a drop-down list indicating the available actions the user may take

function getUATagActions(tag) {
    actions = [];

    switch (tag.tagType) {
        case "TRACK_PAGEVIEW":
            actions.push({ "label": "Ignore", "value": "ignore" });
            actions.push({ "label": "Migrate", "value": "TRACK_PAGEVIEW" });
            break;
        case "TRACK_EVENT":
            actions.push({ "label": "Ignore", "value": "ignore" });
            actions.push({ "label": "Migrate", "value": "TRACK_EVENT", "selected": "selected" });
            break;
        case "TRACK_SOCIAL":
            actions.push({ "label": "Ignore", "value": "ignore" });
            actions.push({ "label": "Migrate", "value": "TRACK_SOCIAL", "selected": "selected" });
            break;
        case "TRACK_TRANSACTION":
            actions.push({ "label": "Ignore", "value": "ignore" });
            actions.push({ "label": "Migrate", "value": "TRACK_TRANSACTION", "selected": "selected" });
            break;
        default:
            actions.push({ "label": "Ignore", "value": "ignore" });
            break;
    };

    return actions;
}

function handleActionChange(element) {
    var tagId = element.dataset.tagId;

    tagIdx = tagsOfInterest.findIndex(t => t.tagId == tagId);
    tag = tagsOfInterest[tagIdx];
    action = element.options[element.selectedIndex].value

    tagsOfInterest[tagIdx].migratedTag = migrateTag(tag, action);

    document.getElementById("tdPreview" + tagId).innerHTML = "";
    document.getElementById("tdPreview" + tagId).appendChild(
        renderjson(tagsOfInterest[tagIdx].migratedTag)
    );
}

function migrateTag(oldTag, action) {
    //If action is to ignore, return empty tag
    if (action == "ignore") {
        return {};
    }

    //Migration tasks common to all tag types

    //TODO look at GA settings for old tag and use mapping to new config tag
    //Tricky because the old tag parameter (key  = gaSettings) uses the variable name, not the ID as the value
    newTag = {};
    newTag.name = processTagName(oldTag.name);
    newTag.type = "gaawe";
    newTag.notes = "Migrated using GAAW migration tool";
    newTag.parameter = [];

    //Determine new measurementId from old settings variable
    var oldGASettingsIdx = oldTag.parameter.findIndex(p => p.key == "gaSettings");
    //If this tag is linked to a settings variable, find its corresponding GAAW measurementId in the mappings variable
    if (oldGASettingsIdx > -1) {
        //In the UA tag, the settings is referenced as a template with {{name}}. Look it up without the brackets
        var oldGASettingsName = oldTag.parameter[oldGASettingsIdx].value.replace("{{", "").replace("}}", "");
        newTag.parameter.push({ 'key': 'measurementId', type: 'tagReference', 'value': settingsToConfigMap[oldGASettingsName] }) 
    }
    //Otherwise assign the default measurementId
    else 
        newTag.parameter.push({ 'key': 'measurementId', type: 'tagReference', 'value': settingsToConfigMap.default })
    
    newTag.firingRuleId = oldTag.firingRuleId;
    newTag.firingTriggerId = oldTag.firingTriggerId;
    newTag.blockingRuleId = oldTag.blockingRuleId;
    newTag.blockingTriggerId = oldTag.blockingTriggerId;

    switch (action) {
        case "TRACK_PAGEVIEW":
            newTag.parameter.push({ 'key': 'eventName', 'type': 'template', 'value': 'page_view' });
            break;
        case "TRACK_SOCIAL":
            newTag.parameter.push({ 'key': 'eventName', 'type': 'template', 'value': 'social_interaction' });
            break;
        case "TRACK_EVENT":
            newTag.parameter.push({ 'key': 'eventName', 'type': 'template', 'value': oldTag.name });
            //Retrieve original event category, action, label
            var event_category = null;
            var event_action = null;
            var event_label = null;

            var idx = oldTag.parameter.findIndex(p => p.key == "eventCategory");
            if (idx > 0) event_category = oldTag.parameter[idx].value;
            idx = oldTag.parameter.findIndex(p => p.key == "eventAction");
            if (idx > 0) event_action = oldTag.parameter[idx].value;
            idx = oldTag.parameter.findIndex(p => p.key == "eventLabel");
            if (idx > 0) event_label = oldTag.parameter[idx].value;

            var eventList = [];
            if (event_category)
                eventList.push({
                    type: "map", map: [
                        { type: "template", key: "name", value: "event_category" },
                        { type: "template", key: "value", value: event_category }
                    ]
                });
            if (event_action)
                eventList.push({
                    type: "map", map: [
                        { type: "template", key: "name", value: "event_action" },
                        { type: "template", key: "value", value: event_action }
                    ]
                });
            if (event_label)
                eventList.push({
                    type: "map", map: [
                        { type: "template", key: "name", value: "event_label" },
                        { type: "template", key: "value", value: event_label }
                    ]
                })
            if (event_category || event_action || event_label)
                newTag.parameter.push({ type: "list", key: "eventParameters", list: eventList });

            break;
    }

    return newTag;
}

var migrateTagIdx = 0;
var numTagsMigrated = 0;
function handleMigrateTagsClick() {
    createTags(); 
    $('#divStepper').hide(); //This fires immediately
    $('#divProgress').show();
}

function createTags() {
    if (migrateTagIdx < tagsOfInterest.length) {
        var tag = tagsOfInterest[migrateTagIdx].migratedTag;
        if (tag.name) {
            console.log("Creating tag " + tag.name);
            var request = gapi.client.tagmanager.accounts.containers.workspaces.tags.create({
                'parent': "accounts/" + current_accountId + "/containers/" + current_containerId + "/workspaces/" + current_workspaceId,
                'name': tag.name,
                'type': "gaawe",
                'notes': tag.notes,
                'parameter': tag.parameter,
                'firingRuleId': tag.firingRuleId,
                'firingTriggerId': tag.firingTriggerId,
                'blockingRuleId': tag.blockingRuleId,
                'blockingTriggerId': tag.blockingTriggerId
            });

            new Promise((resolve, reject) => {
                request.execute((response) => {
                    if (response.code) {
                        reject(response);
                    }
                    resolve(response);
                });
            }).then((response) => {
                numTagsMigrated++;
                //Update progress panel
                document.getElementById("divProgress").innerHTML = Mustache.render(templateProgress, { numTags: numTagsMigrated });
                migrateTagIdx++;
                createTags();
            }).catch((response) => {
                toastError(response);
            })
        } else {
            migrateTagIdx++;
            createTags();
        }
    } else {
        //Hide progress
        $('#divProgress').hide();
        //Show success
        $('#divSuccess').show();
        document.getElementById("divSuccess").innerHTML = Mustache.render(templateSuccess, { numTags: numTagsMigrated });
        //Fire GTM success event
        window.dataLayer.push({ 'event': 'migrate_success' });
    }

}