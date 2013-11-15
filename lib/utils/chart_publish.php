<?php

require_once '../../vendor/cssmin/cssmin.php';
require_once '../../lib/utils/themes.php';
require_once '../../lib/utils/chart_content.php';


function publish_html($user, $chart) {
    $cdn_files = array();

    $static_path = get_static_path($chart);
    $protocol = !empty($_SERVER['HTTPS']) ? "https" : "http";
    $url = $protocol."://".$GLOBALS['dw_config']['domain'].'/chart/'.$chart->getID().'/preview?minify=1';
    $outf = $static_path . '/index.html';
    download($url, $outf);
    download($url . '&plain=1', $static_path . '/plain.html');
    download($url . '&fs=1', $static_path . '/fs.html');

    $chart->setPublishedAt(time() + 5);
    $chart->setLastEditStep(5);
    $chart->save();

    $cdn_files[] = array($outf, $chart->getCDNPath() . 'index.html', 'text/html');
    $cdn_files[] = array($static_path . '/plain.html', $chart->getCDNPath() . 'plain.html', 'text/html');
    $cdn_files[] = array($static_path . '/fs.html', $chart->getCDNPath() . 'fs.html', 'text/html');

    return $cdn_files;
}

function publish_js($user, $chart) {
    $cdn_files = array();
    $static_path = '../../charts/static/lib/';
    $data = get_chart_content($chart, $user, false, '../');

    // generate visualization script
    $vis = $data['visualization'];
    $vis_js = $data['vis_js'];
    if (!file_exists($static_path . $vis_js[0])) {
        // add comment
        $vis_js[1] = "/*\n * datawrapper / vis / {$vis['id']} v{$vis['version']}\n"
                   . " * generated on ".date('c')."\n */\n"
                   . $vis_js[1];
        file_put_contents($static_path . $vis_js[0], $vis_js[1]);
        $cdn_files[] = array(
            $static_path . $vis_js[0],
            'lib/' . $vis_js[0],
            'application/javascript'
        );
    }

    // generate theme script
    $theme = $data['theme'];
    $theme_js = $data['theme_js'];

    if (!file_exists($static_path . $theme_js[0])) {
        $theme_js[1] = "/*\n * datawrapper / theme / {$theme['id']} v{$theme['version']}\n"
                     . " * generated on ".date('c')."\n */\n"
                     . $theme_js[1];
        file_put_contents($static_path . $theme_js[0], $theme_js[1]);
    }
    $cdn_files[] = array(
        $static_path . $theme_js[0],
        'lib/' . $theme_js[0],
        'application/javascript'
    );

    // generate chart script
    $chart_js = $data['chart_js'];
    if (!file_exists($static_path . $chart_js[0])) {
        $chart_js[1] = "/*\n * datawrapper / chart \n"
                     . " * generated on ".date('c')."\n */\n"
                     . $chart_js[1];
        file_put_contents($static_path . $chart_js[0], $chart_js[1]);
    }
    $cdn_files[] = array(
        $static_path . $chart_js[0],
        'lib/' . $chart_js[0],
        'application/javascript'
    );

    return $cdn_files;
}


function publish_css($user, $chart) {
    $cdn_files = array();
    $static_path = get_static_path($chart);
    $data = get_chart_content($chart, $user, false, '../');

    $all = '';

    foreach ($data['stylesheets'] as $css) {
        $all .= file_get_contents('..' . $css)."\n\n";
    }

    // move @imports to top of file
    $imports = array();
    $body = "";
    $lines = explode("\n", $all);
    foreach($lines as $line) {
        if (substr($line, 0, 7) == '@import') $imports[] = $line;
        else $body .= $line."\n";
    }
    $all = implode("\n", $imports) . "\n\n" . $body;

    $cssmin = new CSSmin();
    $minified = $all; //$cssmin->run($all); disabled minification
    file_put_contents($static_path . "/" . $chart->getID() . '.all.css', $minified);

    $cdn_files[] = array(
        $static_path."/".$chart->getID().'.all.css',
        $chart->getCDNPath() . $chart->getID().'.all.css', 'text/css'
    );

    // copy themes assets
    $theme = $data['theme'];
    if (isset($theme['assets'])) {
        foreach ($theme['assets'] as $asset) {
            $asset_src = '../../www/' . $theme['__static_path'] . '/' . $asset;
            $asset_tgt = $static_path . "/" . $asset;
            if (file_exists($asset_src)) {
                file_put_contents($asset_tgt, file_get_contents($asset_src));
                $cdn_files[] = array($asset_src, $chart->getCDNPath() . $asset);
            }
        }
    }

    // copy visualization assets
    $vis = $data['visualization'];
    $assets = DatawrapperVisualization::assets($vis['id'], $chart);
    foreach ($assets as $asset) {
        $asset_src = ROOT_PATH . 'www/static/' . $asset;
        $asset_tgt = $static_path . '/assets/' . $asset;
        create_missing_directories($asset_tgt);
        copy($asset_src, $asset_tgt);
        $cdn_files[] = array($asset_src, $chart->getCDNPath() . 'assets/' . $asset);
    }

    return $cdn_files;
}


function publish_data($user, $chart) {
    $cdn_files = array();
    $static_path = get_static_path($chart);
    file_put_contents($static_path . "/data.csv", $chart->loadData());
    $cdn_files[] = array($static_path . "/data.csv", $chart->getCDNPath() . 'data.csv', 'text/plain');

    return $cdn_files;
}


function publish_push_to_cdn($cdn_files, $chart) {
    DatawrapperHooks::execute(DatawrapperHooks::PUBLISH_FILES, $cdn_files);
}
