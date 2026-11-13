<?php

/**
 * @file
 * One Canvas page per whale tracker concept: /whales/map, /whales/kids, /whales/kids-polar, /whales/research.
 *
 * Run: ddev drush php:script scripts/build-whale-concept-pages.php
 */

use Drupal\canvas\Entity\Page;
use Drupal\Component\Uuid\Php as Uuid;

$data = '/themes/custom/iaato/data/whale-tracks.json';
$concepts = [
  'map' => ['Whale tracker: map', 'whale-map', ['heading' => 'Follow the whales of the Southern Ocean', 'intro' => 'Click a whale pin to see where it has travelled since it was tagged.']],
  'kids' => ['Whale tracker: kids', 'whale-kids', ['heading' => 'Where are the whales?']],
  'kids-polar' => ['Whale tracker: kids circumpolar', 'whale-kids', ['heading' => 'Where are the whales?', 'view' => 'circumpolar']],
  'research' => ['Whale tracker: research', 'whale-science', ['heading' => 'Satellite telemetry: Southern Ocean cetaceans']],
];
$u = new Uuid();
$storage = \Drupal::entityTypeManager()->getStorage('canvas_page');
foreach ($concepts as $slug => [$title, $component, $inputs]) {
  $section = $u->generate();
  // Update in place so page IDs (and open Canvas editor tabs) stay valid.
  $existing = $storage->loadByProperties(['title' => $title]);
  $page = $existing ? reset($existing) : Page::create(['title' => $title, 'status' => TRUE, 'path' => ['alias' => "/whales/$slug"]]);
  $page->set('components', [
    ['uuid' => $section, 'component_id' => 'sdc.iaato.section', 'inputs' => ['background' => str_starts_with($slug, 'kids') ? 'ice' : 'white', 'align' => 'center']],
    ['uuid' => $u->generate(), 'component_id' => "sdc.iaato.$component", 'inputs' => $inputs + ['data_url' => $data], 'parent_uuid' => $section, 'slot' => 'content'],
  ]);
  $v = $page->validate();
  foreach ($v as $x) {
    echo "$slug: " . $x->getPropertyPath() . ': ' . $x->getMessage() . "\n";
  }
  if (count($v)) {
    throw new \RuntimeException("/whales/$slug failed Canvas validation.");
  }
  if (!count($v)) {
    $page->save();
    echo "/whales/$slug -> canvas_page " . $page->id() . "\n";
  }
}
