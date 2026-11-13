<?php

/**
 * @file
 * Builds /whales: the three whale tracker concepts on one Canvas page.
 *
 * Run: ddev drush php:script scripts/build-whales-page.php
 */

use Drupal\canvas\Entity\Page;
use Drupal\Component\Uuid\Php as Uuid;

$data = '/themes/custom/iaato/data/whale-tracks.json';
$u = new Uuid();
$tree = [];
$add = function (string $c, array $inputs, ?string $parent = NULL) use (&$tree, $u): string {
  $id = $u->generate();
  $tree[] = ['uuid' => $id, 'component_id' => "sdc.iaato.$c", 'inputs' => $inputs]
    + ($parent ? ['parent_uuid' => $parent, 'slot' => 'content'] : []);
  return $id;
};

$s = $add('section', ['heading' => 'Concept A: The map', 'intro' => 'Familiar, like the Ambassadorship World Map.', 'background' => 'white', 'align' => 'center']);
$add('whale-map', ['heading' => 'Follow the whales of the Southern Ocean', 'intro' => 'Click a whale pin to see where it has travelled since it was tagged.', 'data_url' => $data], $s);

$s = $add('section', ['heading' => 'Concept B: For little explorers', 'intro' => 'Built for kindergartners: tap a whale to say hi.', 'background' => 'ice', 'align' => 'center']);
$add('whale-kids', ['heading' => 'Where are the whales?', 'data_url' => $data], $s);

$s = $add('section', ['heading' => 'Concept C: For researchers', 'intro' => 'Projection, data quality, statistics and export.', 'background' => 'white', 'align' => 'center']);
$add('whale-science', ['heading' => 'Satellite telemetry: Southern Ocean cetaceans', 'data_url' => $data], $s);

$storage = \Drupal::entityTypeManager()->getStorage('canvas_page');
// Update in place so the page ID (and open Canvas editor tabs) stay valid.
$existing = $storage->loadByProperties(['title' => 'Whale tracker concepts']);
$page = $existing ? reset($existing) : Page::create(['title' => 'Whale tracker concepts', 'status' => TRUE, 'path' => ['alias' => '/whales']]);
$page->set('components', $tree);
$v = $page->validate();
foreach ($v as $x) {
  echo $x->getPropertyPath() . ': ' . $x->getMessage() . "\n";
}
if (count($v)) {
  throw new \RuntimeException('/whales failed Canvas validation.');
}
if (!count($v)) {
  $page->save();
  echo 'Saved canvas_page ' . $page->id() . "\n";
}
