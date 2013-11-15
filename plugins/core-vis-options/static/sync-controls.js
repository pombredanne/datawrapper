
$(function() {

    function syncValue(evt, args) {
        var el = $('#' + args.key);
        el.val(args.chart.get('metadata.visualize.'+args.key));
        function save() {
            args.chart.set('metadata.visualize.'+args.key, el.val());
        }
        el.change(save).keyup(save);
    }

    function syncCheckbox(evt, args) {
        var el = $('#'+args.key);
        if (args.chart.get('metadata.visualize.'+args.key))
            el.prop('checked', 'checked');
        else
            el.removeAttr('checked');
        el.change(function() {
            args.chart.set('metadata.visualize.'+args.key, el.is(':checked'));
        });
    }

    function syncRadio(evt, args) {
        var curVal = args.chart.get('metadata.visualize.'+args.key);
        if (_.isBoolean(curVal)) {
            curVal = curVal ? 'yes' : 'no';
        }
        $('input:radio[name='+args.key+'][value='+curVal+']').prop('checked', true);
        $('input:radio[name='+args.key+']').change(function() {
            var val = $('input:radio[name='+args.key+']:checked').val();
            if (val === 'yes') val = true;
            else if (val === 'no') val = false;
            args.chart.set('metadata.visualize.'+args.key, val);
        });
    }

    function syncSelectAxisColumn(evt, args) {
        _.each(args.option.axes, function(axis) {
            var select = $('select#'+args.key+'-'+axis.id),
                chart = args.chart,
                dataset = chart.dataset(),
                axisMeta = args.vis.meta.axes[axis.id],
                defCol = args.vis.axes()[axis.id];

            // populate select with columns that match accepted types for axis
            dataset.eachColumn(function(column) {
                if (_.indexOf(axisMeta.accepts, column.type()) > -1) {
                    $('<option />')
                        .attr('value', column.name())
                        .html(column.title())
                        .prop('selected', column.name() == defCol)
                        .appendTo(select);
                }
            });

            select.change(function() {
                var axes = _.clone(chart.get('metadata.axes', {}));
                axes[axis.id] = select.val();
                chart.set('metadata.axes', axes);
            });

        });
    }

    $('#vis-options').on('dw:vis-option:select', syncValue);
    $('#vis-options').on('dw:vis-option:text', syncValue);
    $('#vis-options').on('dw:vis-option:checkbox', syncCheckbox);
    $('#vis-options').on('dw:vis-option:radio', syncRadio);
    $('#vis-options').on('dw:vis-option:radio-left', syncRadio);

    // column select
    $('#vis-options').on('dw:vis-option:select-axis-column', syncSelectAxisColumn);

});

