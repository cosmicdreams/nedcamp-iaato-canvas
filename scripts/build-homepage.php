<?php

/**
 * @file
 * Seeds an IAATO-style homepage as a Drupal Canvas page.
 *
 * Run: ddev drush php:script scripts/build-homepage.php
 */

use Drupal\canvas\Entity\Page;
use Drupal\Component\Uuid\Php as Uuid;
use Drupal\Core\File\FileExists;
use Drupal\Core\File\FileSystemInterface;
use Drupal\file\Entity\File;
use Drupal\media\Entity\Media;

$theme_images = DRUPAL_ROOT . '/themes/custom/iaato/images';
$fs = \Drupal::service('file_system');
$dir = 'public://iaato';
$fs->prepareDirectory($dir, FileSystemInterface::CREATE_DIRECTORY | FileSystemInterface::MODIFY_PERMISSIONS);

$media = function (string $name, string $alt) use ($theme_images, $fs, $dir): int {
  $existing = \Drupal::entityTypeManager()->getStorage('media')->loadByProperties(['name' => $name]);
  if ($existing) {
    return (int) reset($existing)->id();
  }
  $uri = $fs->copy("$theme_images/$name", "$dir/$name", FileExists::Replace);
  $file = File::create(['uri' => $uri, 'status' => 1]);
  $file->save();
  $m = Media::create([
    'bundle' => 'image',
    'name' => $name,
    'field_media_image' => ['target_id' => $file->id(), 'alt' => $alt],
  ]);
  $m->save();
  return (int) $m->id();
};

$hero = $media('hero.jpg', 'Glacier face meeting the Southern Ocean');
$c1 = $media('card-1.jpg', 'Expedition guests watching wildlife, photo by Genna Roland');
$c2 = $media('card-2.jpg', 'Whales in Wilhelmina Bay, photo by Genna Roland');
$c3 = $media('card-3.jpg', 'Antarctica, photo by Yuriy Molchanov');

$u = new Uuid();
$tree = [];
$add = function (string $component, array $inputs, ?string $parent = NULL, ?string $slot = NULL) use (&$tree, $u): string {
  $id = $u->generate();
  $item = ['uuid' => $id, 'component_id' => "sdc.iaato.$component", 'inputs' => $inputs];
  if ($parent) {
    $item += ['parent_uuid' => $parent, 'slot' => $slot];
  }
  $tree[] = $item;
  return $id;
};

$add('hero', [
  'eyebrow' => 'Stewards of',
  'heading' => 'Antarctica',
  'tagline' => 'One of the most perfectly preserved regions on the planet',
  'image' => ['target_id' => $hero],
]);

$intro = $add('section', [
  'intro' => 'IAATO is a member organisation founded in 1991 to advocate and promote the practice of safe and environmentally responsible private-sector travel to the Antarctic.',
  'background' => 'white',
  'align' => 'center',
]);

$visit = $add('section', [
  'heading' => 'Visiting Antarctica',
  'intro' => 'Find out about the actions you should take to make your visit safe and environmentally responsible.',
  'background' => 'ice',
  'align' => 'center',
]);
$add('button', ['text' => 'Find out more', 'href' => '/visiting-antarctica', 'variant' => 'dark'], $visit, 'content');

$member = $add('section', [
  'heading' => 'Become a member',
  'intro' => 'Read more about our membership process and the documents you will need to submit.',
  'background' => 'navy',
  'align' => 'start',
]);
$add('button', ['text' => 'Find out more', 'href' => '/about-us/how-to-join', 'variant' => 'light'], $member, 'content');
$add('button', ['text' => 'Already a member? Login', 'href' => '/user/login', 'variant' => 'light'], $member, 'content');

$news = $add('section', ['heading' => 'Latest articles', 'background' => 'white', 'align' => 'center']);
$add('article-card', ['title' => 'Antarctic Travel Season Begins with New Members Joining the Responsible Tourism Fold', 'href' => '/news-room', 'category' => 'News', 'featured' => TRUE, 'image' => ['target_id' => $c1]], $news, 'content');
$add('article-card', ['title' => 'Communicating Responsibly in a Changing Antarctic Tourism Landscape', 'href' => '/news-room', 'category' => 'Opinion', 'featured' => TRUE, 'image' => ['target_id' => $c2]], $news, 'content');
$add('article-card', ['title' => 'Evidence-led decision-making matters, especially when the stakes are high', 'href' => '/news-room', 'category' => 'Opinion', 'featured' => FALSE, 'image' => ['target_id' => $c3]], $news, 'content');

$storage = \Drupal::entityTypeManager()->getStorage('canvas_page');
// Update in place so the page ID (and open Canvas editor tabs) stay valid.
$existing = $storage->loadByProperties(['title' => 'Home']);
$page = $existing ? reset($existing) : Page::create(['description' => 'IAATO homepage', 'title' => 'Home', 'status' => TRUE, 'path' => ['alias' => '/home']]);
$page->set('components', $tree);
$violations = $page->validate();
foreach ($violations as $v) {
  echo $v->getPropertyPath() . ': ' . $v->getMessage() . "\n";
}
if (count($violations)) {
  throw new \RuntimeException('The homepage failed Canvas validation.');
}
if (!count($violations)) {
  $page->save();
  \Drupal::configFactory()->getEditable('system.site')->set('page.front', '/home')->save();
  echo "Saved canvas_page " . $page->id() . "\n";
}
