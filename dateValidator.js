
  getWeek = function(date) {
  date.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year.
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  // January 4 is always in week 1.
  var week1 = new Date(date.getFullYear(), 0, 4);
  // Adjust to Thursday in week 1 and count number of weeks from date to week1.
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000
                        - 3 + (week1.getDay() + 6) % 7) / 7);
}

// Returns the four-digit year corresponding to the ISO week of the date.
getWeekYear = function(date) {
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  return date.getFullYear();
}

getWeeksInYear = function(date){
  var year = date.getFullYear();
  var lastDay = ('12/31/'+year).toString();
  var lastDayDate = new Date(lastDay);
  var weeksInYear = Date.prototype.getWeek(lastDayDate);
  return weeksInYear;
}

formatForJS= function(dateStringIn){
  var dateStringOut = dateStringIn.replace(/^(\d{1,2}\/)(\d{1,2}\/)(\d{4})$/, "$2$1$3");
  return dateStringOut;
}
dateFactory=function(dateIn){
    var dateInDate = new Date(Date.UTC(parseInt(dateIn.substr(6,4)),(parseInt(dateIn.substr(3,2)-1)),parseInt(dateIn.substr(0,2)),0,0,0));
    return dateInDate;
}

isValidDate=function(date){
   return date.getTime() == date.getTime();
}

sequenceFactory=function(dateInDate, frequency){
     //check if valid date, if not error
    var sequence;
    if(frequency=="Weekly"){
    //get the year & week
    var year = getWeekYear(dateInDate).toString();
    var week = getWeek(dateInDate).toString();
    //if week < 10 substring add leading 0
    if(week.length==1){
        week = "0" + week;
    }
    sequence = year + week;
    }
    return sequence;
}

getWeeksInYearForYear = function(year){
  var lastDay = ('12/31/'+year).toString();
  var lastDayDate = new Date(lastDay);
  var weeksInYear = Date.prototype.getWeek(lastDayDate);
  return weeksInYear;
}

exports.formatForJS = formatForJS;
exports.getWeekYear = getWeekYear;
exports.getWeek = getWeek;
exports.getWeeksInYear = getWeeksInYear;
exports.sequenceFactory = sequenceFactory;
exports.getWeeksInYearForYear = getWeeksInYearForYear;
exports.dateFactory = dateFactory;
exports.isValidDate = isValidDate;



