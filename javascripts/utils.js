function getTagTypeLabel(tagType) {
    switch (tagType) {
        case "TRACK_PAGEVIEW":
            return "Pageview";
        case "TRACK_EVENT":
            return "Event";
        case "TRACK_TRANSACTION":
            return "Transaction";
        case "TRACK_SOCIAL":
            return "Social";
        case "TRACK_TIMING":
            return "Timing";
        case "DECORATE_LINK":
            return "Decorate Link";
        case "DECORATE_FORM":
            return "Decorate Form";
    }

}

function processTagName(oldName) {
    var newName = oldName.replace(/\s*UA\s*-\s*/i, "").replace(/\s*GA\s*-\s*/i, "");
    return "GAAW - " + newName;
}

function toastError(response) {
    //429 is quote exceeded
    if (response.code == 429) {
        $('.toast').toast('show');
        console.error(response);
        document.getElementById('toastBody').innerHTML = "<span style='color:red'>Quote limit exceeded. Try again later</span>";
    }
    else {
        $('.toast').toast('show');
        console.error(response);
        document.getElementById('toastBody').innerHTML = "<span style='color:red'>Google reported an error. See console log for details</span>";
    }
}