<?php

/**
 * @file
 * Configures the IAATO theme: main menu links and block placements.
 *
 * Idempotent. Run: ddev drush php:script scripts/configure-site.php
 */

use Drupal\block\Entity\Block;
use Drupal\menu_link_content\Entity\MenuLinkContent;

$links = [
  'About Us' => '/about-us',
  'Antarctic Treaty' => '/antarctic-treaty',
  'Visiting Antarctica' => '/visiting-antarctica',
  'Antarctic Ambassadors' => '/antarctic-ambassadors',
  'Supporting Science' => '/supporting-science',
  'News & Resources' => '/news-room',
];
$storage = \Drupal::entityTypeManager()->getStorage('menu_link_content');
$weight = 0;
foreach ($links as $title => $path) {
  if (!$storage->loadByProperties(['menu_name' => 'main', 'title' => $title])) {
    MenuLinkContent::create(['title' => $title, 'link' => ['uri' => "internal:$path"], 'menu_name' => 'main', 'weight' => $weight])->save();
  }
  $weight++;
}
// The standard profile's "Home" link duplicates the logo.
\Drupal::service('plugin.manager.menu.link')->updateDefinition('standard.front_page', ['enabled' => FALSE]);

// Blocks the IAATO page template expects; every other block in the theme is removed.
$wanted = [
  'iaato_main_menu' => ['primary_menu', 'system_menu_block:main', ['level' => 1, 'depth' => 1]],
  'iaato_messages' => ['highlighted', 'system_messages_block', []],
  'iaato_primary_local_tasks' => ['highlighted', 'local_tasks_block', ['primary' => TRUE, 'secondary' => FALSE]],
  'iaato_secondary_local_tasks' => ['highlighted', 'local_tasks_block', ['primary' => FALSE, 'secondary' => TRUE]],
  'iaato_content' => ['content', 'system_main_block', []],
];
foreach (Block::loadMultiple() as $block) {
  if ($block->getTheme() === 'iaato' && !isset($wanted[$block->id()])) {
    $block->delete();
  }
}
$weight = 0;
foreach ($wanted as $id => [$region, $plugin, $settings]) {
  $block = Block::load($id) ?? Block::create(['id' => $id, 'theme' => 'iaato', 'plugin' => $plugin]);
  $block->setRegion($region);
  $block->setWeight($weight++);
  $block->set('settings', ['label_display' => '0'] + $settings + ($block->get('settings') ?? []));
  $block->save();
}
echo "Configured menu and blocks.\n";
