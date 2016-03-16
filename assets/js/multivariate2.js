
function loadHealthData() {
    d3.csv("./data/violation_report.csv", function(data) {
        console.log('data acquired from ./data/violation_report.csv');
        console.log(data);
        
        //---- Data Preparation

        //Group by region (EPA Region)
        regionData = _.groupBy(data, 'EPA Region');

        //Features to consider in report
        var features = ["Violation Type", "Is Health Based", "Is Major Violation", "Contaminant Name", "Compliance Status", "PWS Type", "Primacy Agency", "Primary Source", "Public Notification Tier"];
        //["Violation Type", "Is Health Based", "Is Major Violation", "Contaminant Name", "Compliance Status"];

        //Violation Stats Per Region Global Variable
        window.regionViolationStats = {};

        //Prepare Data for Dashboard
        
        featureData = _.map(regionData, function(records, key) {
            //Reduce Region Records into feature set
            var reduced = _.reduce(records, function(r1, r2) {
            	//sum the population count
                var result = {
                    "Population Served Count": parseInt(r1["Population Served Count"]) + parseInt(r2["Population Served Count"])
                };
                //concatenate nominal values
                for (var i = 0; i < features.length; i++) {
                    var feature = features[i];
                    result[feature] = r1[feature] + ',' + r2[feature];
                }

                return result;
            });

            //group feature results - will be accessed later
            regionViolationStats[key] = {};

            //identify number of different nominal values in each feature
            for (var i = 0; i < features.length; i++) {
            	
                regionViolationStats[key][features[i]] =
                    _.countBy(
                    	reduced[features[i]] //get concatenated nominal values
                        .replace(/\([a-zA-Z0-9 \/\-]+\)/g, '') //remove data within brackets
                        .replace(/ *, */g, '|') //remove spaces and trim (left and right ) each entry
                        .split('|') //split into features
                    ); //count occurence of each feature
            }
            regionViolationStats[key]["Population Served Count"] = reduced["Population Served Count"];

            //transform first feature into format accepted by dashboard
            return {
                id: key + ' - ' + reduced["Population Served Count"] + ' Persons',
                stats: _.map(regionViolationStats[key][features[0]], function(val, name) {
                    return {
                        name: name,
                        value: val
                    }
                }).filter(function(stat) {
                    return stat.value > 300
                })
            };
        });



        //Add features to drop down in dashboard title
        features.forEach(function(feature) {
            $('.bar-chart-title select').append('<option value="' + feature + '">' + feature + ' </option>');
        });

        //listen for changes in dropdown values or minimum occurence filter
        $('.bar-chart-title select, .bar-chart-title input').change(function(evt) {
        	 $('.loading').show();
        	//reset dashboard
        	$('.sandbox').html('');
        	$('.legend, .controls').remove();
        	//get chosen feature 
            var newFeature = $('.bar-chart-title select').val();
            //get specified minimum occurence filter
            var filterMin = $('.bar-chart-title input').val();
            //verify whether minimum occurence filter is a number
            if(isNaN(filterMin) || filterMin==""){
            	//if not a number simply replace with default and refresh dashboard
            	//window.alert('The value entered is not a number, the default of 500 minimum reports will be used');
                $('.bar-chart-title input').val(0);
                filterMin = 0;
            }
            filterMin = parseFloat(filterMin);
            //prepare data in format required by dashboard
            window.ourArray = _.map(regionViolationStats, function(records, key) {
                return {
                    id: key + ' - ' + regionViolationStats[key]["Population Served Count"] + ' Persons',
                    stats: _.map(regionViolationStats[key][newFeature], function(val, name) {
                        return {
                            name: name,
                            value: val
                        }
                    }).filter(function(stat) {
                        return stat.value > filterMin //apply filter
                    })
                };
            });
            //refresh dashboard
        
            universalController();
             $('.loading').hide();
        });
        //display initial dash board
        window.ourArray = featureData;
        universalController();
        $('.loading').hide();

    }); //d3.tsv
}; //loadHealthData









/*=======================================================
INITIALIZATION
=======================================================*/

// jQuery has a $(document).ready() function that fires when your page is ready to go.
// let's use it to kick things off.
$(document).ready(function() {
    loadHealthData();
}); //document.ready


// Think of universalController() as our Table of Contents
function universalController() {

    console.log('Universal Controller - ready to run your functions!');

    ////// STEP 1: Draw a bar for each year of our data.
    initializeBars(ourArray);

    ////// STEP 2: Allow for user interaction with our visualization
    initializeControls();

    ////// STEP 3: Advanced interaction through a click and hold interface
    handleTouch();

}; //universalController










/*=======================================================
STEP 1: STATIC BAR GRAPH
=======================================================*/

function initializeBars(comparable) {
    // We create a new element using jQuery. We can style it in CSS using the .bar-chart class.
    $('.sandbox').append('<div class="bar-chart"></div>');

    // We reduce our comparable to yearly totals
    yearTotals = _.map(comparable, function(obj, iter) {
        var valueArray = _.pluck(obj.stats, "value");
        return _.reduce(valueArray, function(memo, num) {
            return memo + num
        });
    }); //_.map

    // For each of this yearly totals, create a bar in our new bar chart.
    $.each(yearTotals, function(key, value) {
        $('.bar-chart').append('<div class="bar" data-index="' + comparable[key].id + '" data-value="' + value + '"><span><em>' + comparable[key].id + ':</em> <strong>' + commafy(value) + '</strong></span></div>');
    }); //each yearTotals

    //////// Step 1A: Make the length of each bar relative to its $ spent
    relativeBarWidths();

    //////// Step 1B: Drop another level of metrics in: a breakdown of the yearly spend
    createLegend(comparable);
    applyCategories(comparable);

    //////// Step 1C: Make the width of each category proportional to 
    setCategoryWidths();
    setCategoryRatios(comparable);

}; //initializeBars




/*=======================================================
STEP 1A: RELATIVE BAR WIDTHS
=======================================================*/

// Each bar should have its width proportional to the relative max
function relativeBarWidths() {
    var max = _.max(yearTotals);
    $('.bar').each(function() {
        $(this).css({ 'width': $(this).attr('data-value') / max * 100 + "%" })
    }); //each bar
}; //relativeBarWidths




/*=======================================================
STEP 1B: SPEND-BY-CATEGORY LEVEL OF DATA
=======================================================*/

function createLegend(comparable) {
    var colorRange = d3.scale.category20().domain(d3.range(101).reverse());
    $('.bar-chart').after('<div class="legend"></div>');
    var categories = _.pluck(comparable[0].stats, 'name');
    $.each(categories, function(key, value) {
        var span = $('<span>' + value + '</span>');
        span.css({ 'border-color': d3.rgb(colorRange(key)).brighter(1) });
        span.css({ 'background-color': d3.rgb(colorRange(key)).darker(1) });
        $('.legend').append(span);
    })
}; //createLegend

function applyCategories(comparable) {
    var colorRange = d3.scale.category20().domain(d3.range(101).reverse());
    $('.bar').each(function() {
        var bar = $(this);
        bar.append('<div class="statsblock"></div>');
        var index = bar.attr('data-index');
        var relevantStats = _.findWhere(comparable, { 'id': index })['stats'];
        $.each(relevantStats, function(key, value) {
            var stat = $('<span class="stat" title="'+value['name']+'" data-index="' + value['name'] + '" data-value="' + value['value'] + '"></span>');
            stat.css({ 'background-color': colorRange(key) });
            bar.children('.statsblock').append(stat);
        }); //each relevantStats
    }); //each bar
}; //applyCategories




/*=======================================================
STEP 1C: CATEGORY LEVEL WIDTHS AS PROPORATION OF SPEND
=======================================================*/

function setCategoryWidths() {
    $('.bar').each(function() {
        var bar = $(this);
        var index = bar.attr('data-index');
        var relevantStats = _.findWhere(ourArray, { 'id': index })['stats'];
        var barTotal = _.reduce(_.pluck(relevantStats, 'value'), function(memo, num) {
            return memo + num
        });
        $.each($(this).find('.stat'), function(stat_id, stat) {
            $(stat).css({ 'width': $(stat).attr('data-value') / barTotal * 100 + "%" });
        })
    })
}

// ratios of each spending category, will be used later to normalize by category spending
function setCategoryRatios(comparable) {
    var categoryTotals = _.map(comparable[0]['stats'], function(obj, iter) {
        return _.reduce(_.map(comparable, function(obj2, iter2) {
            var b = _.find(obj2.stats, function(obj3, iter3) {
                return obj3.name == obj.name;
            });
            return b ? b.value : 0;
        }), function(memo, num) {
            return memo + num
        }); //reduce
    }); //categoryTotals
    var average = _.reduce(categoryTotals, function(memo, num) {
        return memo + num;
    }, 0) / categoryTotals.length;

    // Setting categoryRatios as a global variable that we can access later
    categoryRatios = [];
    $.each(categoryTotals, function(i) {
        categoryRatios[i] = 1 / (categoryTotals[i] / average);
    })
    categoryRatios = _.object(_.pluck(ourArray[0]['stats'], 'name'), categoryRatios);

    // storing the categoryRatios on the comparable object and ourArray
    comparable = _.map(comparable, function(obj, iter) {
        var stats = _.map(obj.stats, function(obj2, iter2) {
            obj2.normalizedValue = categoryRatios[obj2.name] * obj2.value;
            return obj2;
        }); //innermap
        obj.stats = stats;
        return obj;
    }); //map
    ourArray = comparable;
}; //setCategoryRatios



















/*=======================================================
STEP 2: User Interface Controls
=======================================================*/

function initializeControls() {
    // Set up a controls box that can be style with css with .controls{}
    $('#world-container').after('<div class="controls"><h5>Controls</h5></div>');
    $('.controls').append('<div><h6>Categories Full Height:</h6><a class="cat_full_height_on">On</a><a class="cat_full_height_off">Off</a></div>')
    $('.controls').append('<div><h6>Normalize by Annual Volume ("what is the % of annual spend?"):</h6><a class="norm_tv_on">On</a><a class="norm_tv_off">Off</a></div>')
    $('.controls').append('<div><h6>Normalize by Category Size: ("what year made the biggest impact to a given category?")</h6><a class="norm_cs_on">On</a><a class="norm_cs_off">Off</a></div>')

    // Set the initial state of our on/off switches
    $('.norm_tv_off').addClass('active');
    $('.norm_cs_off').addClass('active');
    $('.cat_full_height_off').addClass('active');

    // Category heights
    $(document).on('click', '.cat_full_height_on', function() {
        $('.statsblock').css({ 'height': '100%' });
        $('.cat_full_height_on').addClass('active').siblings().removeClass('active');
    })
    $(document).on('click', '.cat_full_height_off', function() {
        $('.statsblock').css({ 'height': '3px' });
        $('.cat_full_height_off').addClass('active').siblings().removeClass('active');
    })

    // Normalized Annual Volume
    $(document).on('click', '.norm_tv_on', function() {
        $('.bar').css({ 'width': '100%' });
        $('.norm_tv_on').addClass('active').siblings().removeClass('active');
    })
    $(document).on('click', '.norm_tv_off', function() {
        relativeBarWidths();
        $('.norm_tv_off').addClass('active').siblings().removeClass('active');
    })

    // Normalized Category Size
    $(document).on('click', '.norm_cs_on', function() {
        normalizeCategories();
        $('.norm_cs_on').addClass('active').siblings().removeClass('active');
    })
    $(document).on('click', '.norm_cs_off', function() {
        setCategoryWidths();
        $('.norm_cs_off').addClass('active').siblings().removeClass('active');
    })
}; //initializeControls


function normalizeCategories() {
    $('.bar').each(function() {
        var bar = $(this);
        var index = bar.attr('data-index');
        var relevantStats = _.findWhere(ourArray, { 'id': index })['stats'];
        var normalizedBarTotal = _.reduce(_.pluck(relevantStats, 'normalizedValue'), function(memo, num) {
            return memo + num
        });
        $.each($(this).find('.stat'), function(stat_id, stat) {
            $(stat).css({ 'width': $(stat).attr('data-value') * categoryRatios[$(stat).attr('data-index')] / normalizedBarTotal * 100 + "%" });
        }); //each stat (category) in the bar
    }); //each bar
}; //normalizeCategories










/*=======================================================
STEP 3: HANDLE ADVANCED INTERACTION
=======================================================*/

/*=======================================================
STEP 3: HANDLE ADVANCED INTERACTION
=======================================================*/

function handleTouch() {
    // Observe the "mousedown" (click + hold) event on all of our category color-bars
    $(document).on('mousedown', '.stat', function(evt) {
            var self = this;
            var globaloffset = $(this).position().left;
            $('.statsblock').each(function() {
                $(this).css({ 'height': '100%' });
                var blockoffset = $(this).children('[data-index="' + $(self).attr('data-index') + '"]').position().left;
                $(this).animate({ 'left': globaloffset - blockoffset }, 200);
                $(this).parents('.bar').children('span').children('strong').text(commafy($(this).children('[data-index="' + $(self).attr('data-index') + '"]').attr('data-value')));
            }); //each

            // Fade out all bars not of the category you clicked
            $('.stat:not("[data-index=' + $(self).attr('data-index') + ']")').css({ 'opacity': 0.2 });
            $('.stat[data-index=' + $(self).attr('data-index') + ']').addClass('active');
            $('.bar').css({ 'background-color': 'transparent' });

            //// OPTIONAL: Sort bars based on order
            // var barHeight = $('.bar').height() + 11;
            // var sorted = _.sortBy($('.stat[data-index="' + $(self).attr('data-index') + '"]'), function(obj, iter) {
            //     return $(obj).width();
            // }); //sorted
            // _.map(sorted, function(obj, iter) {
            //     var startHeight = barHeight * (iter) - $(obj).parents('.bar').position().top + 20;
            //     $(obj).parents('.bar').css({ 'top': startHeight }).attr('which', iter);
            // })

            // Reset the position of everything wehn you release your mouse
            $(document).on('mouseup', function() {
                $('.statsblock').animate({ 'left': '0px', 'height': $('.cat_full_height_on').is('.active') ? '100%' : '3px' }, 200);
                $('.stat').css({ 'opacity': '1' }).removeClass('active');
                $('.bar').css({ 'top': '0px', 'background-color': 'rgba(0,0,0,0.1)' });
                $('.bar').each(function() {
                    $(this).children('span').children('strong').text(commafy($(this).attr('data-value')));
                })
                $(document).off('mouseup');
            }); //documnet on mouseup
            return false;
        }) //click

}; //handleTouch



// Make big numbers into pretty numbers
function commafy(num) {
    if (num) {
        var str = num.toString().split('.');
        if (str[0].length >= 4) {
            str[0] = str[0].replace(/(\d)(?=(\d{3})+$)/g, '$1,');
        }
        if (str[1] && str[1].length >= 5) {
            str[1] = str[1].replace(/(\d{3})/g, '$1 ');
        }
        return str.join('.');
    }
}; //commafy
