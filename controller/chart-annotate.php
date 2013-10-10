<?php


require_once '../lib/utils/themes.php';

/*
 * VISUALIZE STEP
 */
$app->get('/chart/:id/annotate', function ($id) use ($app) {
    disable_cache($app);

    check_chart_writable($id, function($user, $chart) use ($app) {
        $page = array(
            'chartData' => $chart->loadData(),
            'chart' => $chart,
            'vis' => DatawrapperVisualization::get($chart->getType()),
            'themes' => DatawrapperTheme::all(),
            'theme' => DatawrapperTheme::get($chart->getTheme())
        );
        add_header_vars($page, 'chart', 'chart-editor/annotate.css');
        add_editor_nav($page, 3);

        $app->render('chart/annotate.twig', $page);
    });
});

