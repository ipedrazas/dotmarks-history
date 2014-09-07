var bkms = new Array();
var historyObjects = new Array();
var allVisits = new Array();


function getUrlVar(key, url){
    var result = new RegExp(key + "=([^&]*)", "i").exec(url);
    return result && unescape(result[1]) || "";
}

function randomString(length, chars) {
    var result = '';
    for (var i = length; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
    return result;
}

function cleanUp(url) {
    if(url.search(/^https?\:\/\//) != -1)
        url = url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i, "");
    else
        url = url.match(/^([^\/?#]+)(?:[\/?#]|$)/i, "");
    url[1] = url[1].replace(/^www\./i, "");
    return url[1];
}


// POST the data to the server using XMLHttpRequest
function addBookmark(bulk) {
     // The URL to POST our data to
    var postUrl = 'https://api.dotmarks.net/history';

    // Set up an asynchronous AJAX POST request
    var xhr = new XMLHttpRequest();
    xhr.open('POST', postUrl, true);
    // Set correct header for form data
    xhr.setRequestHeader('Content-type', 'application/json');
    xhr.send(JSON.stringify(bulk));
};

var anonymous = randomString(32, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');

function createObject(historyItem){
  // console.log(historyItem);
  var o = {};
    o['user'] = anonymous;
    o['url'] = historyItem.url;
    o['domain'] = cleanUp(historyItem.url);
    var search = getUrlVar("q", historyItem.url);
    if(search !== undefined){
        var aSearch = search.split("+");
        aSearch = aSearch.filter(Boolean); // remove empty strings
        if(aSearch.length > 0){
          o['search'] = aSearch;
        }
    }
    if(historyItem.title !== undefined) {
        o['title'] = historyItem.title;
    }
    o['visitCount'] = historyItem.visitCount;
    o['typedCount'] = historyItem.typedCount;

  return o;
}

function createParseDateObject(dateInMilis){
    var visit_time = new Date(dateInMilis);
    var time  = {};
    time['time'] = visit_time;
    time['vtime'] = dateInMilis;
    time['year'] = visit_time.getFullYear();
    time['month'] = visit_time.getMonth() + 1;
    time['day'] = visit_time.getDate();
    time['seconds'] = visit_time.getSeconds();
    time['hours'] = visit_time.getHours();
    time['minutes'] = visit_time.getMinutes();
    time['weekday'] = visit_time.getDay();

    return time;
}

// Search history to find up to ten links that a user has typed in,
// and show those links in a popup.
function buildTypedUrlList(startTime, endTime) {

  // Track the number of callbacks from chrome.history.getVisits()
  // that we expect to get.  When it reaches zero, we have all results.
  var numRequestsOutstanding = 0;

  chrome.history.search({
        'text': '',              // Return every history item....
        'startTime': startTime,
        'endTime': endTime,
        'maxResults': 0
    },
    function(historyItems) {
      // For each history item, get details on all visits.
      for (var i = 0; i < historyItems.length; ++i) {
        var item = createObject(historyItems[i]);
        historyObjects.push(item);
        var processVisitsWithUrl = function(item) {
          // We need the url of the visited item to process the visit.
          // Use a closure to bind the  url into the callback's args.
          return function(visitItems) {
            processVisits(item, visitItems);
          };
        };
        chrome.history.getVisits({url: item.url}, processVisitsWithUrl(item));
        numRequestsOutstanding++;
      }
      if (!numRequestsOutstanding) {
        onAllVisitsProcessed();
      }
    });


  // Maps URLs to a count of the number of times the user typed that URL into
  // the omnibox.
  var urlToCount = {};

  // Callback for chrome.history.getVisits().  Counts the number of
  // times a user visited a URL by typing the address.
  var processVisits = function(historyItem, visitItems) {

    var visits = new Array();
    for (var i = 0, ie = visitItems.length; i < ie; ++i) {
        var visit = {};
        var time = createParseDateObject(visitItems[i].visitTime);
        var visitItem = JSON.parse(JSON.stringify(historyItem));
        visitItem['vid'] = visitItems[i].visitId;
        visitItem['referringVisitId'] = visitItems[i].referringVisitId
        visitItem['transition'] = visitItems[i].transition;
        visitItem['time'] = time;
        visitItem['visitNumber'] = i;
        // visitItem['id'] =  i + "." +historyItem['visitCount'] + "." + historyItem['user'] + "." + visitItems[i].visitId + "." + time['vtime'];
        allVisits.push(visitItem);
        visits.push(visit);
    }

    historyItem['visits'] = visits;
    bkms.push(historyItem);

    // If this is the final outstanding call to processVisits(),
    // then we have the final results.  Use them to build the list
    // of URLs to show in the popup.
    if (!--numRequestsOutstanding) {
      onAllVisitsProcessed();
    }
  };

  // This function is called when we have the final list of URls to display.
  var onAllVisitsProcessed = function() {
    if(allVisits.length>0){
      console.log("All Visits");
      console.log(allVisits.length);
      console.log(allVisits);
      addBookmark(allVisits);
      allVisits = new Array();
      document.write("<b>User:</b><a target=\"_blank\" href=\"https://dotmarks.net/lab/history.html?u=" + anonymous  + "\">View your stats here</a><br/>");
    }
  };
}

document.addEventListener('DOMContentLoaded', function () {

  var step = 10;
  for(var i=0; i<11; ++i){
      var endDate = 1000 * 60 * 60 * 24 * i*step;
      var startDate = 1000 * 60 * 60 * 24 *(step*(i+1));
      var endTime = (new Date).getTime() - endDate;
      var startTime = (new Date).getTime() - startDate;
      if(startDate > endDate){
        buildTypedUrlList(startTime, endTime);
      }
    }

});
