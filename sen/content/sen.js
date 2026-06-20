function menuAction(action){
switch(action) {
    case "goBack":
        document.location.href = "../index.html"
        break;
    default:
        alert("invalid action")
}
}